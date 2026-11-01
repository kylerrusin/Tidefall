/** World-anchored aperiodic value noise, domain-warped banks and sun-facing billows. */
export const CLOUD_GLSL=`
float hash3(vec3 p){p=fract(p*vec3(.1031,.11369,.13787));p+=dot(p,p.yzx+19.19);return fract((p.x+p.y)*p.z);}
uniform sampler2D cloudNoise;
float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);vec2 uv=(i.xz+vec2(17.,37.)*i.y+f.xz+.5)/64.;vec2 slices=texture2D(cloudNoise,uv).rg;return mix(slices.x,slices.y,f.y);}
float fbm(vec3 p){float a=.5,v=0.;for(int i=0;i<5;i++){v+=a*n3(p);p=mat3(.8,0.,.6,0.,1.,0.,-.6,0.,.8)*p*2.07+vec3(7.1,3.8,11.7);a*=.5;}return v;}
vec4 cloudLayer(vec3 d,vec3 eye,vec3 light,vec2 wind,float t,float cover,float daylight,float steps){
 if(d.y<=.004||eye.y>2200.||cover<.005)return vec4(0.);
 float nearT=max(0.,(580.-eye.y)/d.y),farT=min(11000.,(2200.-eye.y)/d.y);if(farT<=nearT)return vec4(0.);
 vec3 drift=vec3(wind.x*t*.7,0.,wind.y*t*.7);float trans=1.;vec3 radiance=vec3(0.);float stepT=(farT-nearT)/steps;
 for(int i=0;i<8;i++){if(float(i)>=steps)break;vec3 w=eye+d*(nearT+(float(i)+.5)*stepT),p=(w-drift)*vec3(.0018,.0025,.0018);
 float bank=n3(vec3(p.x*.28,2.7,p.z*.28)),base=580.+bank*260.,top=base+420.+bank*1100.,height=(w.y-base)/(top-base),vertical=smoothstep(0.,.16,height)*(1.-smoothstep(.42,1.,height));
 float mass=n3(p+vec3(bank*1.7,0.,bank*.9)),detail=n3(p*3.1+vec3(3.2,7.1,1.3)),density=max(0.,bank*.6+mass*.58+detail*.12-(.94-cover*.27))*vertical*5.;
 float shadow=n3(p+light*.7+vec3(bank*1.7,0.,bank*.9)),lightTransmission=exp(-density*1.8-max(0.,shadow-mass)*2.4),illumination=clamp(.16+height*.42+lightTransmission*.55,.18,1.),phase=.72+.28*pow(max(0.,dot(d,light)),6.);
 vec3 color=mix(vec3(.025,.035,.055),mix(vec3(.17,.21,.27),vec3(.9,.9,.86),illumination)*phase,daylight);float opacity=1.-exp(-density*stepT*.005);radiance+=trans*opacity*color;trans*=1.-opacity;}
 return vec4(radiance/max(.001,1.-trans),(1.-trans)*smoothstep(.004,.065,d.y));
}`;
