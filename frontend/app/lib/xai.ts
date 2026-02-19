// ── xAI direct API helpers ──

export async function xaiImageGenerate(prompt: string, aspectRatio = '1:1'): Promise<string> {
  const res = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-imagine-image-pro',
      prompt,
      n: 1,
      aspect_ratio: aspectRatio,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (typeof err?.error === 'string' && err.error.toLowerCase().includes('content moderation')) {
      throw new Error('Generated image rejected by content moderation.');
    }
    throw new Error(`xAI image error ${res.status}: ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  return data.data[0].url;
}

export async function xaiImageEdit(prompt: string, imageUrl: string): Promise<string> {
  const res = await fetch('https://api.x.ai/v1/images/edits', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-imagine-image-pro',
      prompt,
      image: { url: imageUrl, type: 'image_url' },
      n: 1,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (typeof err?.error === 'string' && err.error.toLowerCase().includes('content moderation')) {
      throw new Error('Generated image rejected by content moderation.');
    }
    throw new Error(`xAI image edit error ${res.status}: ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  return data.data[0].url;
}

// ── xAI direct video API ──

export async function xaiSubmitVideo(
  prompt: string,
  duration: number,
  imageUrl?: string
): Promise<string> {
  const body: Record<string, unknown> = {
    model: 'grok-imagine-video',
    prompt,
    duration: Math.min(duration, 15),
    aspect_ratio: '9:16',
    resolution: '720p',
  };
  if (imageUrl) {
    body.image = { url: imageUrl };
  }

  const res = await fetch('https://api.x.ai/v1/videos/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (typeof err?.error === 'string' && err.error.toLowerCase().includes('content moderation')) {
      throw new Error('Generated image rejected by content moderation.');
    }
    throw new Error(`xAI video submit error ${res.status}: ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  return data.request_id;
}

export async function xaiPollVideo(requestId: string): Promise<{ status: string; videoUrl?: string; error?: string }> {
  const res = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
    headers: {
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errorMsg = err.error || err.message || `xAI error ${res.status}`;
    return { status: 'failed', error: errorMsg };
  }
  const data = await res.json();
  if (data.video?.url) {
    return { status: 'done', videoUrl: data.video.url };
  }
  return { status: data.status || 'processing' };
}
