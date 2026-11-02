const fs = require('fs');
let c = fs.readFileSync('src/app/api/subtitles/youtube/route.ts', 'utf8');

c = c.replace(
  'let videoTitle = YouTube Video ();',
  'let videoTitle = `YouTube Video (${videoId})`;'
);
c = c.replace(
  'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=&format=json,',
  '`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,'
);

fs.writeFileSync('src/app/api/subtitles/youtube/route.ts', c);
console.log('Fixed youtube route string interpolation');

