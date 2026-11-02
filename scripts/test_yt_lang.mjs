import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

async function test() {
  const videoId = 'AFVexpKO3UM';
  console.log('Fetching watch page for', videoId);
  const res = await fetch('https://www.youtube.com/watch?v=' + videoId, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  const html = await res.text();
  const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
  if (!match) return console.log('No player response match');
  
  const data = JSON.parse(match[1]);
  const title = data?.videoDetails?.title;
  console.log('Video Title:', title);
  console.log('Author/Channel:', data?.videoDetails?.author);
  
  const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  console.log('Caption tracks count:', captionTracks.length);
  for (const t of captionTracks) {
    console.log(`- name: "${t.name?.simpleText}", code: "${t.languageCode}", kind: "${t.kind}", vssId: "${t.vssId}"`);
  }

  // Check if we can fetch English from the timedtext API
  if (captionTracks[0]) {
    const rawUrl = captionTracks[0].baseUrl;
    console.log('\nTrying baseUrl directly:');
    const r1 = await fetch(rawUrl + '&fmt=json3');
    const d1 = await r1.json();
    console.log('Direct text sample:', d1.events?.slice(0, 3).map(e => e.segs?.map(s => s.utf8).join('')));

    console.log('\nTrying baseUrl with &tlang=en:');
    const r2 = await fetch(rawUrl + '&tlang=en&fmt=json3');
    const d2 = await r2.json();
    console.log('Translated to English sample:', d2.events?.slice(0, 5).map(e => e.segs?.map(s => s.utf8).join('')));
  }
}

test();
