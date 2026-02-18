import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { supabaseAdmin } from '@/app/lib/supabase-server';
import { describeImageForPrompt, generateShotsPrompts } from '@/app/lib/openrouter';
import { handleError } from '@/app/lib/api-utils';

function genJobId(): string {
  return 'job_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { character_id, source_image_path, spicy } = body;

    if (!character_id || !source_image_path) {
      return NextResponse.json(
        { error: 'character_id and source_image_path are required' },
        { status: 400 }
      );
    }

    // Get character from DB
    const { data: character, error: charError } = await supabaseAdmin
      .from('characters')
      .select('*')
      .eq('id', character_id)
      .eq('user_id', user.id)
      .single();

    if (charError || !character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    // Step 1: Describe the source image
    const description = await describeImageForPrompt(source_image_path);

    // Step 2: Generate 5 variation prompts
    const prompts = await generateShotsPrompts(description, 5);

    // Step 3: Create 5 job rows
    const jobs: { id: string; prompt: string }[] = [];
    for (const shotPrompt of prompts) {
      const jobId = genJobId();
      const { error: jobError } = await supabaseAdmin
        .from('jobs')
        .insert({
          id: jobId,
          user_id: user.id,
          character_id,
          job_type: 'shots',
          status: 'pending',
          input_data: {
            prompt: shotPrompt,
            source_image_path,
            spicy: !!spicy,
          },
        });

      if (jobError) throw new Error(jobError.message);
      jobs.push({ id: jobId, prompt: shotPrompt });
    }

    return NextResponse.json({ jobs });
  } catch (error: any) {
    return handleError(error);
  }
}
