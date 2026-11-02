const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch {}

async function checkWatchPage() {
  const videoId = 'AFVexpKO3UM';
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  const html = await res.text();
  const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
  if (!match) {
    console.log('No ytInitialPlayerResponse match');
    return;
  }
  const data = JSON.parse(match[1]);
  console.log('playabilityStatus:', data.playabilityStatus?.status);
  console.log('captions present:', Boolean(data.captions));
  const formats = data?.streamingData?.adaptiveFormats || [];
  const audioFormats = formats.filter(f => f.mimeType?.includes('audio'));
  console.log('audio formats count:', audioFormats.length);
  if (audioFormats[0]) {
    console.log('audio format 0 mimeType:', audioFormats[0].mimeType);
    console.log('audio format 0 has direct url:', Boolean(audioFormats[0].url));
  }
}

checkWatchPage();

