/** Authoritative fixed anchors shared by gameplay placement and geological clearance. */
export const LANDER={x:0,z:-105};
export const SITES=[{id:'echo',name:'The Echo Vault',kind:'cavern',x:-46,z:12},{id:'ember',name:'Ember Gardens',kind:'vent',x:68,z:2},{id:'lens',name:'Drowned Observatory',kind:'ruin',x:8,z:64}] as const;
export const SHELTERS=[{id:'west',name:'Fault shelter',x:-58,z:-55},{id:'east',name:'Basalt shelter',x:62,z:-55}] as const;
export const FACILITY_SITES={marine:{x:-56,z:-104},volcanic:{x:82,z:-90}};
export const EXTRACTION_SITES=[[-12,-113],[12,-113],[-12,-94],[12,-94],[0,-82],[-42,-108],[45,-108]] as const;

export const GEOLOGY_REFERENCES=[{x:28,z:-85,scale:1.8,angle:Math.PI},{x:73,z:-43,scale:1.65,angle:2.7}] as const;
export const LAVA_N=33,LAVA_DX=1,LAVA_X=52,LAVA_Z=-14;
