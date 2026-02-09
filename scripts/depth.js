const fs=require('fs');
const path='packages/core/src/expansion/engine.ts';
let src=fs.readFileSync(path,'utf8');
// crude removal of backtick strings
src=src.replace(/`[\s\S]*?`/g,'');
src=src.replace(/'[^'\\\n]*'/g,'');
src=src.replace(/\"[^\"\\\n]*\"/g,'');
let depth=0;let line=1;let col=0;let minDepth=0;let firstZero=null;let events=[];
for(let i=0;i<src.length;i++){
  const ch=src[i];
  if(ch==='\n'){line++;col=0;continue;} else col++;
  if(ch==='{' ){ depth++; events.push({line, col, depth, ch}); }
  if(ch==='}' ){ depth--; events.push({line, col, depth, ch}); if(depth===0) firstZero=firstZero||{line, col}; if(depth<minDepth) minDepth=depth; }
}
console.log('final depth',depth,'minDepth',minDepth,'firstZero',firstZero);
console.log('last 40 events');
console.log(events.slice(-40));
