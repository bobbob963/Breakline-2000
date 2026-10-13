import { DEFAULT_KEYBINDS, getControlMap, keyLabel, sanitizeKeybinds } from './key-bindings.js';

const tokenActions={A:'left',D:'right',W:'pump',S:'brake',SPACE:'jump',SHIFT:'grind',E:'action',J:'spin',K:'flip',L:'grab',U:'shuvit',O:'heelflip',H:'method',F:'spin360',I:'special',B:'tweak',C:'cutback',Q:'timePower',ENTER:'bank',P:'pause',R:'restart',M:'sound'};
const arrowActions={'←':['ArrowLeft','left'],'→':['ArrowRight','right'],'↑':['ArrowUp','pump'],'↓':['ArrowDown','brake']};
const keyTokens=/\b(?:SPACE|SHIFT|ENTER|[ADWSEJKLUOHFIBCQPRM])\b|[←→↑↓]/gi;
const sources=new WeakMap();

function labelForToken(token,bindings,controls) {
  if(arrowActions[token]){
    const [code,action]=arrowActions[token];
    return controls[code]===action?token:keyLabel(bindings[action]);
  }
  const action=tokenActions[token.toUpperCase()];
  if(!action)return token;
  // Retain the familiar short default badge, but specify a remapped side.
  if(action==='grind'&&bindings.grind==='ShiftLeft')return 'SHIFT';
  return keyLabel(bindings[action]);
}

/** Map labels authored with the default controls. Separators are retained. */
export function remapKeyLabel(text,rawBindings=DEFAULT_KEYBINDS) {
  const bindings=sanitizeKeybinds(rawBindings),controls=getControlMap(bindings),source=String(text??'');
  return source.replace(keyTokens,token=>arrowActions[token]&&/[A-Z]/i.test(source)?token:labelForToken(token,bindings,controls));
}

/** Map explicit game-key references, leaving prose and menu shortcuts alone. */
export function remapControlText(text,rawBindings=DEFAULT_KEYBINDS) {
  const bindings=sanitizeKeybinds(rawBindings),controls=getControlMap(bindings);
  let source=String(text??'');
  const leftAlias=controls.ArrowLeft==='left',rightAlias=controls.ArrowRight==='right';
  if(!leftAlias||!rightAlias)source=source.replace('Left and right arrows work too.',leftAlias?'The left arrow also turns left.':rightAlias?'The right arrow also turns right.':'Use your chosen turning keys.');
  if(controls.ArrowUp!=='pump')source=source.replace('The up arrow also pumps.','Use your chosen pump key.');
  if(controls.ArrowDown!=='brake')source=source.replace('The down arrow also slows you.','Use your chosen brake key.');
  return source.replace(keyTokens,(token,offset)=>{
    const before=source.slice(0,offset),after=source.slice(offset+token.length),upper=token.toUpperCase();
    // X / C rotates the workshop preview and is deliberately not rebindable.
    if(upper==='C'&&/\bX\s*\/\s*$/.test(before))return token;
    const isNamedKey=upper==='SPACE'||upper==='SHIFT';
    const instruction=/\b(?:press|hold|release|holding|using|use|uses|with|then|follow|try|tap|double-tap)\s*$/i.test(before);
    const actionSuffix=/^\s+(?:TO (?:POP|PUMP|BRAKE|BANK|RELEASE|SLOW|GRIND|CUT|RESTART|PAUSE|RESUME)|also works\b|toggles\b|switches sound\b|restarts\b|pauses\b|banks\b|rides pipe\b|turns sharply\b|or Esc\b)/.test(after);
    const keyPair=/(?:\b[ADWSEJKLUOHFIBCQPRM]|SHIFT|Shift)\s*[/+]\s*$/.test(before)||/^\s*[/+]\s*(?:[ADWSEJKLUOHFIBCQPRM]\b|SHIFT\b|Shift\b)/.test(after);
    const hudToken=/(?:^|·|NEXT:)\s*$/.test(before)&&/^\s*(?:·|$)/.test(after);
    if(upper==='ENTER'&&!/^\s+(?:banks\b|TO BANK\b)/.test(after))return token;
    if(!isNamedKey&&!instruction&&!actionSuffix&&!keyPair&&!hudToken)return token;
    // Lower-case articles and words are never interpreted as one-letter keys.
    if(token.length===1&&token!==upper&&!arrowActions[token])return token;
    if(bindings[tokenActions[upper]]===DEFAULT_KEYBINDS[tokenActions[upper]])return token;
    return labelForToken(token,bindings,controls);
  });
}

function remapNode(node,bindings,badge=false) {
  const field=badge?'textContent':'nodeValue',current=node[field]??'';
  let stored=sources.get(node);
  if(!stored||stored.rendered!==current)stored={source:current};
  const rendered=badge?remapKeyLabel(stored.source,bindings):remapControlText(stored.source,bindings);
  node[field]=rendered;sources.set(node,{source:stored.source,rendered});
}

/** Reapply to an existing help/footer element whenever bindings change. */
export function remapControlsElement(root,bindings=DEFAULT_KEYBINDS) {
  if(!root)return;
  const visit=node=>{
    if(node.nodeType===3){remapNode(node,bindings);return;}
    const tag=String(node.tagName??'').toUpperCase();
    if(tag==='KBD'){remapNode(node,bindings,true);return;}
    if(['SCRIPT','STYLE','INPUT','TEXTAREA','SELECT'].includes(tag))return;
    for(const child of node.childNodes??[])visit(child);
  };
  visit(root);
}
