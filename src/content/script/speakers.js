// Line builders shared by the script modules (not a script module itself: script.js does not merge it).
// L = Lavinia, O = Lavinia off (a voice behind a door, or the shimmer on the dark stage), P = Pike, C = the cat,
// N = the narrator as a spoken line (no portrait). A bare string in the script is a caption instead.
export const L = (text) => ({ who: 'lavinia', text });
export const O = (text) => ({ who: 'lavinia_off', text });
export const P = (text) => ({ who: 'pike', text });
export const C = (text) => ({ who: 'cat', text });
export const N = (text) => ({ who: 'narrator', text });
