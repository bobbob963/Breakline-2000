// Weather is a run setting. Rendering never rolls dice, so pausing, changing
// equipment and resizing cannot silently change the sky or conditions.
const preset = value => Object.freeze(value);
export const WEATHER_PRESETS = Object.freeze({
  dawn: preset({ id:'dawn', label:'FIRST LIGHT', timeLabel:'06:10', skyTop:0x66739e, horizon:0xf5ba9b, background:0xe4b6a0, fog:0xc4adac, deep:0x183849, water:0x558e93, foam:0xf5e6c9, sun:0xffdcc0, sunX:105, sunY:27, sunSize:1.03, sunOpacity:.88, ambient:0xd6c5d6, ground:0x494558, ambientPower:1.65, light:0xffd3ad, lightPower:2.05, cloud:0xceaeac, cloudOpacity:.30, cloudCover:.35, wind:.35, rain:0, fogNear:90, fogFar:280 }),
  noon: preset({ id:'noon', label:'HIGH TIDE', timeLabel:'12:40', skyTop:0x3572a5, horizon:0x98c7cd, background:0xbcd8d2, fog:0x96b9c0, deep:0x103f5d, water:0x36a4a3, foam:0xf4f0d0, sun:0xfff6d7, sunX:-100, sunY:148, sunSize:.74, sunOpacity:1, ambient:0xb9e2e9, ground:0x3f4550, ambientPower:2.0, light:0xffedc4, lightPower:2.3, cloud:0xe5edda, cloudOpacity:.42, cloudCover:.26, wind:.24, rain:0, fogNear:110, fogFar:300 }),
  sunset: preset({ id:'sunset', label:'GOLDEN HOUR', timeLabel:'19:15', skyTop:0x66516e, horizon:0xef9871, background:0xebb17d, fog:0xb8948e, deep:0x253448, water:0x628b92, foam:0xffdfb0, sun:0xffcc79, sunX:-95, sunY:24, sunSize:1.22, sunOpacity:1, ambient:0xd5c0c0, ground:0x453344, ambientPower:1.7, light:0xffbb7e, lightPower:2.4, cloud:0x9d737d, cloudOpacity:.50, cloudCover:.44, wind:.42, rain:0, fogNear:90, fogFar:260 }),
  dusk: preset({ id:'dusk', label:'BLUE HOUR', timeLabel:'20:35', skyTop:0x303e61, horizon:0x859ba7, background:0x778897, fog:0x697f91, deep:0x18283d, water:0x426d83, foam:0xc7d7d8, sun:0xcfd8e6, sunX:105, sunY:80, sunSize:.57, sunOpacity:.64, ambient:0xa8bfd5, ground:0x343b52, ambientPower:1.6, light:0xc3d1ea, lightPower:1.5, cloud:0x3f5067, cloudOpacity:.63, cloudCover:.7, wind:.58, rain:0, fogNear:80, fogFar:235 }),
  storm: preset({ id:'storm', label:'SQUALL LINE', timeLabel:'17:50', skyTop:0x252f41, horizon:0x657a83, background:0x64747d, fog:0x576c79, deep:0x162833, water:0x355f69, foam:0xc4d3cd, sun:0xa8b8b8, sunX:-90, sunY:70, sunSize:.85, sunOpacity:0, ambient:0xa0b7c2, ground:0x30384a, ambientPower:1.55, light:0xb8ced4, lightPower:1.55, cloud:0x293542, cloudOpacity:.87, cloudCover:1, wind:1, rain:1, fogNear:75, fogFar:215 }),
});

export const WEATHER_IDS = Object.freeze(Object.keys(WEATHER_PRESETS));
export function getSurfWeather(id) { return Object.hasOwn(WEATHER_PRESETS,id) ? WEATHER_PRESETS[id] : WEATHER_PRESETS.sunset; }
export function chooseSurfWeather(previousId, random = Math.random) {
  const options = WEATHER_IDS.filter(id => id !== previousId);
  const value = Number(random());
  const fraction = Number.isFinite(value) ? Math.max(0,Math.min(.999999999,value)) : 0;
  return options[Math.floor(fraction * options.length)];
}

// Preserve established lighting for races, trials and Reef Rush.
export const LEGACY_SURF_WEATHER = preset({ ...WEATHER_PRESETS.noon, id:'legacy', label:'COASTLINE', timeLabel:'', skyTop:0x38578c, horizon:0xa1babe, background:0xe7c48d, fog:0x91a7b0, deep:0x0b2447, water:0x298a9c, foam:0xe3e8c4, sun:0xf3dac0, sunX:-95, sunY:42, sunSize:1, ambient:0xb4d9e3, ground:0x3a364b, ambientPower:2, light:0xffe3bb, lightPower:2.3, cloudOpacity:0, cloudCover:0, fogNear:85, fogFar:265 });
export function resolveWorldWeather(game) {
  if(game.mode === 'park')return null;
  if(game.rulesId === 'storm' && !game.isRace)return WEATHER_PRESETS.storm;
  if(game.rulesId === 'surf' && !game.isRace && !game.isTimeTrial)return getSurfWeather(game.weatherId);
  return LEGACY_SURF_WEATHER;
}

// A distant, soft lightning pulse, never a full-screen white flash. Reduced
// motion removes it entirely; elapsed time makes pause/finish deterministic.
export function weatherLightning(time, weather, reducedMotion = false) {
  if(reducedMotion || !weather?.rain || !Number.isFinite(time) || time < 7)return 0;
  const phase=(time-7)%13.7;
  return phase < .65 ? Math.sin(phase/.65*Math.PI)*.13 : 0;
}
