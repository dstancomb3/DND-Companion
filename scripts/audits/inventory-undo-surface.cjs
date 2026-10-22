const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '../..');
process.chdir(root);
const ts = require('typescript');
const files = cp.execFileSync('git', ['ls-files'], {encoding:'utf8'}).trim().split('\n');
const result = {baselineCommit: cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), scope:'Static candidate inventory of tracked non-test, non-generated TS/TSX sources. Method declarations, syntactic storage write sites and route declarations are not unique operations or proof of semantic coverage.', contextMethods:[], storageWrites:[], serverRoutes:[]};
for (const file of files.filter(x=>/\.(tsx?|mts|cts)$/.test(x) && !/(\/tests\/|\.test\.|\/generated\/)/.test(x))) {
 const text=fs.readFileSync(file,'utf8');
 const src=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const line=n=>src.getLineAndCharacterOfPosition(n.getStart(src)).line+1;
 function visit(n){
  if (/context\/(Character|Combat|AdventureSession|Party|MutationHistory)Context\.tsx$/.test(file) && ts.isInterfaceDeclaration(n) && /Context(Type|Value)$/.test(n.name.text)) {
   for(const m of n.members) if(ts.isPropertySignature(m)&&m.type&&ts.isFunctionTypeNode(m.type)) result.contextMethods.push({file,line:line(m),interface:n.name.text,name:m.name.getText(src),signature:m.type.getText(src).replace(/\s+/g,' ')});
  }
  if (ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)) {
   const receiver=n.expression.expression.getText(src), method=n.expression.name.text;
   if(file.startsWith('artifacts/living-character-sheet/') && ['AsyncStorage','localStorage','storage'].includes(receiver) && ['setItem','removeItem','multiSet','multiRemove','clear','mergeItem'].includes(method)) result.storageWrites.push({file,line:line(n),receiver,method,keyExpression:n.arguments[0]?.getText(src)??null});
   if(file.startsWith('artifacts/api-server/src/routes/')&&receiver==='router'&&['get','post','put','patch','delete'].includes(method)) result.serverRoutes.push({file,line:line(n),method:method.toUpperCase(),path:n.arguments[0]?.getText(src)});
  }
  ts.forEachChild(n,visit);
 }
 visit(src);
}
fs.mkdirSync('docs/audits',{recursive:true});
fs.writeFileSync('docs/audits/undo-snapshot-inventory.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({contextMethods:result.contextMethods.length,storageWriteSites:result.storageWrites.length,serverRoutes:result.serverRoutes.length,partyRoutes:result.serverRoutes.filter(x=>x.file.endsWith('/party.ts')).length}));
console.log(JSON.stringify(result.contextMethods.reduce((a,x)=>(a[x.interface]=(a[x.interface]||0)+1,a),{})));
