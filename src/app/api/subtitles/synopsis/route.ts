import { NextRequest, NextResponse } from 'next/server';
import { generateVideoSynopsis, type CueItem } from '@/lib/synopsis';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, language, originalLanguage, cues, duration, sourceType } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Video title is required' }, { status: 400 });
    }

    const safeOriginalLanguage =
      typeof originalLanguage === 'string' && originalLanguage.trim()
        ? originalLanguage.trim()
        : typeof language === 'string' && language.trim()
        ? language.trim()
        : 'English';
    const safeLanguage = safeOriginalLanguage;
    const safeCues: CueItem[] = Array.isArray(cues) ? cues : [];

    const synopsis = await generateVideoSynopsis({
      title,
      language: safeLanguage,
      originalLanguage: safeOriginalLanguage,
      cues: safeCues,
      duration: typeof duration === 'number' ? duration : undefined,
      sourceType: typeof sourceType === 'string' ? sourceType : undefined,
    });

    // Optionally record to searches if user is authenticated
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from('searches').insert({
          user_id: user.id,
          topic: `[Synopsis] ${title}`,
        });
      }
    } catch {
      // Non-blocking telemetry
    }

    return NextResponse.json({ success: true, synopsis });
  } catch (err) {
    console.error('Error generating synopsis:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate synopsis' },
      { status: 500 }
    );
  }
}
