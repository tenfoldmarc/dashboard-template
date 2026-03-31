import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGoogleAccessToken } from '@/lib/google-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const ZERNIO_KEY = process.env.ZERNIO_API_KEY?.trim();
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY?.trim();
const OPENAI_KEY = process.env.OPENAI_API_KEY?.trim();
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID || 'YOUR_DRIVE_FOLDER_ID';
const CUTOFF_DATE = process.env.CONTENT_CUTOFF_DATE || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const PLATFORM_ACCOUNTS: Record<string, string> = {
  instagram: process.env.ZERNIO_INSTAGRAM_ACCOUNT_ID || 'YOUR_INSTAGRAM_ACCOUNT_ID',
  tiktok: process.env.ZERNIO_TIKTOK_ACCOUNT_ID || 'YOUR_TIKTOK_ACCOUNT_ID',
  youtube: process.env.ZERNIO_YOUTUBE_ACCOUNT_ID || 'YOUR_YOUTUBE_ACCOUNT_ID',
  facebook: process.env.ZERNIO_FACEBOOK_ACCOUNT_ID || 'YOUR_FACEBOOK_ACCOUNT_ID',
};

// Cached voice reference — loaded once per request
let cachedVoiceRef: string | null = null;

async function getVoiceReference(): Promise<string> {
  if (cachedVoiceRef) return cachedVoiceRef;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('client_posts')
    .select('content')
    .order('posted_at', { ascending: false })
    .limit(15);
  cachedVoiceRef = (data || [])
    .map((p: { content: string }) => p.content)
    .filter((c: string) => c && c.length > 20)
    .slice(0, 10)
    .map((c: string, i: number) => `${i + 1}. "${c.slice(0, 300)}"`)
    .join('\n');
  return cachedVoiceRef;
}

// ─── Google Drive helpers ───

async function verifyDriveFolder(): Promise<boolean> {
  const token = await getGoogleAccessToken();
  if (!token) return false;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${DRIVE_FOLDER_ID}?fields=id`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

async function listDriveVideos(): Promise<{ id: string; name: string; mimeType: string; webViewLink: string; thumbnailLink: string; createdTime: string }[]> {
  const token = await getGoogleAccessToken();
  if (!token) return [];
  const query = `'${DRIVE_FOLDER_ID}' in parents and trashed=false and (mimeType contains 'video/' or mimeType contains 'image/') and createdTime > '${CUTOFF_DATE}'`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink,thumbnailLink,createdTime)&orderBy=createdTime desc&pageSize=50`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  return (await res.json()).files || [];
}

async function downloadDriveFile(fileId: string): Promise<{ buffer: ArrayBuffer; mimeType: string } | null> {
  const token = await getGoogleAccessToken();
  if (!token) return null;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return { buffer: await res.arrayBuffer(), mimeType: res.headers.get('content-type') || 'video/mp4' };
}

// ─── Transcribe with Whisper ───

async function transcribe(buffer: ArrayBuffer, fileName: string): Promise<string> {
  if (!OPENAI_KEY) { console.error('Transcribe: No OPENAI_API_KEY'); return ''; }

  let fileBuffer = buffer;
  const sizeMB = buffer.byteLength / (1024 * 1024);
  console.log(`Transcribe: ${fileName} (${sizeMB.toFixed(1)}MB)`);

  // Whisper API limit is 25MB — truncate if larger
  // Sending the first 24MB of the video still captures all the audio for the caption
  if (sizeMB > 24) {
    console.log(`Transcribe: Truncating from ${sizeMB.toFixed(1)}MB to 24MB for Whisper`);
    fileBuffer = buffer.slice(0, 24 * 1024 * 1024);
  }

  try {
    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer], { type: 'video/mp4' }), 'video.mp4');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`Transcribe: Whisper API ${res.status} — ${err.slice(0, 200)}`);
      return '';
    }
    const text = await res.text();
    console.log(`Transcribe: Success — ${text.slice(0, 100)}...`);
    return text;
  } catch (err) {
    console.error('Transcribe: Exception —', err instanceof Error ? err.message : err);
    return '';
  }
}

// ─── Generate caption with Claude ───

async function generateCaption(transcript: string, title: string, voiceRef: string): Promise<{ caption: string; youtubeTitle: string }> {
  if (!ANTHROPIC_KEY) return { caption: '', youtubeTitle: '' };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: `You are a social media caption writer. The owner posts about their industry and audience.

Recent captions for style reference:
${voiceRef}

${transcript ? `Video transcript:\n"${transcript.slice(0, 1500)}"` : `Video title: "${title}"`}

Write TWO things:

1. CAPTION: A social media caption. Rules:
- Match the owner's tone from the style reference
- Strong hook first line
- Line breaks for readability
- CTA at the end
- 3-5 relevant hashtags at the end
- Under 2200 characters

2. YOUTUBE_TITLE: A short, catchy YouTube Shorts title under 80 characters. No hashtags. Should make people want to click.

Format your response EXACTLY like this:
---CAPTION---
[the caption here]
---YOUTUBE_TITLE---
[the title here]` }],
      }),
    });
    if (!res.ok) return { caption: '', youtubeTitle: '' };
    const data = await res.json();
    const text = data.content?.find((c: { type: string }) => c.type === 'text')?.text || '';

    // Parse the structured response
    const captionMatch = text.match(/---CAPTION---\s*([\s\S]*?)(?:---YOUTUBE_TITLE---|$)/);
    const ytTitleMatch = text.match(/---YOUTUBE_TITLE---\s*([\s\S]*?)$/);

    const caption = captionMatch ? captionMatch[1].trim() : text;
    const youtubeTitle = ytTitleMatch ? ytTitleMatch[1].trim().slice(0, 100) : caption.split('\n')[0].slice(0, 80);

    return { caption, youtubeTitle };
  } catch { return { caption: '', youtubeTitle: '' }; }
}

// ─── Zernio helpers ───

async function uploadToZernio(fileName: string, fileType: string, fileBuffer: ArrayBuffer): Promise<string | null> {
  if (!ZERNIO_KEY) return null;
  try {
    const presignRes = await fetch('https://zernio.com/api/v1/media/presign', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ZERNIO_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: fileName, contentType: fileType }),
    });
    if (!presignRes.ok) return null;
    const { uploadUrl, publicUrl } = await presignRes.json();
    if (!uploadUrl || !publicUrl) return null;

    const putRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': fileType }, body: fileBuffer });
    if (!putRes.ok) return null;
    return publicUrl;
  } catch { return null; }
}

async function scheduleOnZernio(
  caption: string, mediaPublicUrl: string, platforms: string[],
  scheduledFor: Date, youtubeTitle?: string, isTrialReel?: boolean,
): Promise<{ success: boolean; postId?: string; error?: string }> {
  if (!ZERNIO_KEY) return { success: false, error: 'ZERNIO_API_KEY not configured' };

  const platformEntries = platforms.map(p => {
    const entry: Record<string, unknown> = { platform: p, accountId: PLATFORM_ACCOUNTS[p] };
    if (p === 'youtube') {
      entry.platformSpecificData = { title: youtubeTitle || caption.slice(0, 100), visibility: 'public', madeForKids: false };
    }
    if (p === 'instagram' && isTrialReel) {
      entry.platformSpecificData = { trialParams: { graduationStrategy: 'MANUAL' } };
    }
    return entry;
  }).filter(e => e.accountId);

  const body: Record<string, unknown> = { content: caption, platforms: platformEntries, scheduledFor: scheduledFor.toISOString() };
  if (mediaPublicUrl) body.mediaItems = [{ type: 'video', url: mediaPublicUrl }];

  try {
    const res = await fetch('https://zernio.com/api/v1/posts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ZERNIO_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { success: false, error: (await res.text()).slice(0, 300) };
    const data = await res.json();
    return { success: true, postId: data.post?._id || data._id || 'scheduled' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed' };
  }
}

// ═══════════════════════════════════════════════════════
// GET: Check Drive for new files, transcribe + generate captions
// ═══════════════════════════════════════════════════════

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data: queue } = await supabase.from('content_queue').select('*').order('created_at', { ascending: false });

    // Auto-publish: mark scheduled items as published if scheduled_for is >15 min in the past
    const now = new Date();
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const scheduledItems = (queue || []).filter(
      (q: { status: string; scheduled_for: string | null }) =>
        q.status === 'scheduled' && q.scheduled_for && new Date(q.scheduled_for) < fifteenMinAgo
    );
    for (const item of scheduledItems) {
      await supabase.from('content_queue').update({
        status: 'published',
        published_at: item.scheduled_for,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
    }

    const driveConnected = await verifyDriveFolder();
    let newFilesFound = 0;
    let processing = 0;

    if (driveConnected) {
      const driveFiles = await listDriveVideos();
      const existingFileIds = new Set((queue || []).map((q: { drive_file_id: string }) => q.drive_file_id).filter(Boolean));

      // Load voice reference once for all new files
      const voiceRef = await getVoiceReference();

      for (const file of driveFiles) {
        if (existingFileIds.has(file.id)) continue;

        newFilesFound++;
        processing++;

        const cleanTitle = file.name.replace(/\.[^.]+$/, '');
        let transcript = '';
        let suggestedCaption = '';
        let suggestedYtTitle = '';

        try {
          // Download the video
          const fileData = await downloadDriveFile(file.id);

          if (fileData) {
            // Try transcription
            try {
              transcript = await transcribe(fileData.buffer, file.name);
              console.log(`[queue] Transcribed "${file.name}": ${transcript.length} chars`);
            } catch (transcribeErr) {
              console.error(`[queue] Transcription failed for "${file.name}":`, transcribeErr);
            }
          } else {
            console.error(`[queue] Download failed for "${file.name}" (${file.id})`);
          }

          // Generate caption ONLY if we have a transcript — don't guess from filename
          if (transcript) {
            try {
              const generated = await generateCaption(transcript, cleanTitle, voiceRef);
              suggestedCaption = generated.caption;
              suggestedYtTitle = generated.youtubeTitle;
              console.log(`[queue] Caption generated for "${file.name}": ${suggestedCaption.length} chars`);
            } catch (captionErr) {
              console.error(`[queue] Caption generation failed for "${file.name}":`, captionErr);
            }
          } else {
            console.log(`[queue] No transcript for "${file.name}" — caption will be generated when user clicks Regenerate`);
          }
        } catch (err) {
          console.error(`[queue] Processing failed for "${file.name}":`, err);
        }

        const { error: insertError } = await supabase.from('content_queue').insert({
          title: cleanTitle,
          drive_file_id: file.id,
          drive_file_name: file.name,
          drive_file_url: file.webViewLink,
          thumbnail_url: file.thumbnailLink || null,
          transcript: transcript || null,
          suggested_caption: suggestedCaption || null,
          caption: suggestedCaption || null,
          youtube_title: suggestedYtTitle || null,
          status: 'ready',
        });
        if (insertError) {
          console.error(`[queue] Supabase insert failed for "${file.name}":`, insertError);
        }
      }
    }

    const { data: updatedQueue } = await supabase.from('content_queue').select('*').order('created_at', { ascending: false });

    return NextResponse.json({
      queue: updatedQueue || [],
      newFilesFound,
      processing,
      driveFolderId: DRIVE_FOLDER_ID,
      driveConnected,
      platforms: Object.keys(PLATFORM_ACCOUNTS),
    });
  } catch (error) {
    return NextResponse.json({ queue: [], error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════
// POST: Schedule, update, or delete queue items
// ═══════════════════════════════════════════════════════

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;
    const supabase = createAdminClient();

    if (action === 'schedule') {
      const { id, caption, platforms, scheduledFor, youtubeTitle, isTrialReel } = body;

      if (!id || !platforms || platforms.length === 0 || !scheduledFor) {
        return NextResponse.json({ error: 'id, platforms, and scheduledFor are required' }, { status: 400 });
      }

      const { data: item } = await supabase.from('content_queue').select('*').eq('id', id).single();
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

      // Download from Drive + upload to Zernio
      let mediaPublicUrl = item.media_url;
      if (!mediaPublicUrl && item.drive_file_id) {
        const fileData = await downloadDriveFile(item.drive_file_id);
        if (!fileData) return NextResponse.json({ error: 'Failed to download from Google Drive' }, { status: 500 });

        mediaPublicUrl = await uploadToZernio(item.drive_file_name || 'video.mp4', fileData.mimeType, fileData.buffer);
        if (!mediaPublicUrl) return NextResponse.json({ error: 'Failed to upload to Zernio' }, { status: 500 });
      }

      // Schedule via Zernio — use stored YouTube title if not provided
      const finalYoutubeTitle = youtubeTitle || item.youtube_title || undefined;
      const result = await scheduleOnZernio(
        caption || item.caption || item.title || '',
        mediaPublicUrl || '', platforms,
        new Date(scheduledFor), finalYoutubeTitle, isTrialReel,
      );

      await supabase.from('content_queue').update({
        caption: caption || item.caption,
        status: result.success ? 'scheduled' : 'failed',
        platforms, scheduled_for: scheduledFor, media_url: mediaPublicUrl,
        is_trial_reel: isTrialReel || false,
        zernio_post_ids: { postId: result.postId },
        error: result.success ? null : result.error,
        updated_at: new Date().toISOString(),
      }).eq('id', id);

      return NextResponse.json({ success: result.success, postId: result.postId, error: result.error });
    }

    if (action === 'update') {
      const { id, caption, title } = body;
      const updates: Record<string, string> = {};
      if (caption !== undefined) updates.caption = caption;
      if (title !== undefined) updates.title = title;
      updates.updated_at = new Date().toISOString();
      await supabase.from('content_queue').update(updates).eq('id', id);
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      await supabase.from('content_queue').delete().eq('id', body.id);
      return NextResponse.json({ success: true });
    }

    if (action === 'regenerate-caption') {
      const { id } = body;
      const { data: item } = await supabase.from('content_queue').select('*').eq('id', id).single();
      if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const voiceRef = await getVoiceReference();
      const { caption, youtubeTitle: ytTitle } = await generateCaption(item.transcript || '', item.title || '', voiceRef);
      await supabase.from('content_queue').update({ suggested_caption: caption, caption, youtube_title: ytTitle, updated_at: new Date().toISOString() }).eq('id', id);
      return NextResponse.json({ success: true, caption, youtubeTitle: ytTitle });
    }

    if (action === 'sync-zernio') {
      if (!ZERNIO_KEY) return NextResponse.json({ error: 'ZERNIO_API_KEY not configured' }, { status: 500 });

      const { data: scheduledItems } = await supabase
        .from('content_queue')
        .select('*')
        .eq('status', 'scheduled');

      const results: { id: string; title: string; newStatus: string }[] = [];

      for (const item of scheduledItems || []) {
        const postId = item.zernio_post_ids?.postId;
        if (!postId || postId === 'scheduled') continue;

        try {
          const res = await fetch(`https://zernio.com/api/v1/posts/${postId}`, {
            headers: { Authorization: `Bearer ${ZERNIO_KEY}` },
          });

          if (res.status === 404) {
            await supabase.from('content_queue').update({
              status: 'removed',
              error: 'Post deleted from Zernio',
              updated_at: new Date().toISOString(),
            }).eq('id', item.id);
            results.push({ id: item.id, title: item.title, newStatus: 'removed' });
          } else if (res.ok) {
            const post = await res.json();
            const postStatus = post.post?.status || post.status;

            if (postStatus === 'published' || postStatus === 'completed') {
              await supabase.from('content_queue').update({
                status: 'published',
                published_at: post.post?.publishedAt || new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }).eq('id', item.id);
              results.push({ id: item.id, title: item.title, newStatus: 'published' });
            } else if (postStatus === 'failed' || postStatus === 'error') {
              await supabase.from('content_queue').update({
                status: 'failed',
                error: `Zernio status: ${postStatus}`,
                updated_at: new Date().toISOString(),
              }).eq('id', item.id);
              results.push({ id: item.id, title: item.title, newStatus: 'failed' });
            }
            // If still 'scheduled'/'pending' in Zernio, leave as-is
          }
        } catch (err) {
          console.error(`[sync-zernio] Failed to check post ${postId}:`, err);
        }
      }

      return NextResponse.json({ success: true, synced: results.length, results });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
