// Restored original oval identity, drawn once for menus and factory banners.
// This uses the game's own lettering and shapes, not the reference screenshot.
export function createClassicLogoCanvas() {
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=320;
  const c=canvas.getContext('2d');
  c.translate(398,161);c.rotate(-.105);
  const oval=()=>{c.beginPath();c.ellipse(0,0,322,112,0,0,Math.PI*2);};
  c.save();c.translate(5,8);oval();c.fillStyle='#090e18';c.fill();c.restore();
  const steel=c.createLinearGradient(0,-110,30,110);
  steel.addColorStop(0,'#747f8e');steel.addColorStop(.45,'#465664');steel.addColorStop(.46,'#17222e');steel.addColorStop(1,'#1e303b');
  oval();c.fillStyle=steel;c.fill();c.lineWidth=14;c.strokeStyle='#0d1520';c.stroke();
  oval();c.lineWidth=7;c.strokeStyle='#acbdbb';c.stroke();
  const orange=c.createLinearGradient(-390,0,375,0);orange.addColorStop(0,'#d84c38');orange.addColorStop(1,'#ee8346');
  c.beginPath();c.moveTo(-408,35);c.lineTo(379,-88);c.lineTo(305,-27);c.lineTo(369,-31);c.lineTo(-407,98);c.lineTo(-367,57);c.closePath();c.fillStyle=orange;c.fill();
  c.lineJoin='round';c.textBaseline='alphabetic';
  const lettering=(text,x,y,size,width,fill,outline)=>{
    c.save();c.translate(x,y);c.font=`900 ${size}px Impact, 'Arial Narrow', sans-serif`;
    c.scale(width/c.measureText(text).width,1);c.lineWidth=12;c.strokeStyle='#0c1520';c.strokeText(text,4,5);
    c.lineWidth=7;c.strokeStyle=outline;c.strokeText(text,0,0);c.lineWidth=2;c.strokeStyle='#111824';c.strokeText(text,0,0);
    c.fillStyle=fill;c.fillText(text,0,0);c.restore();
  };
  lettering('BREAKLINE',-232,-7,108,448,'#0c1420','#d7dfd8');
  lettering("'99",190,105,95,118,'#d85b3b','#090f19');
  c.font="900 30px Impact, 'Arial Narrow', sans-serif";c.fillStyle='#0b1520';c.fillText('EXTREME SURFING',-259,66);
  c.fillStyle='#f0e8d6';c.fillText('EXTREME SURFING',-261,63);
  return canvas;
}
