export const vertexShader=/* glsl */`
  uniform float uTime,uEnergy,uGlitch,uMobius,uOffset,uRibbonRadius;
  uniform float uWavePhase,uWaveAmplitude,uWaveComplexity,uDeformation,uWidthVariation,uTwist;
  uniform float uErrorDistort,uErrorTear,uErrorCollapse,uErrorEject,uErrorContainment,uErrorJerk,uErrorSeed;
  uniform float uGeometryDamage;
  varying vec2 vUv;
  varying vec3 vPos,vNormal;
  varying float vWave;

  vec3 rotateAroundAxis(vec3 value,vec3 axis,float angle){
    return value*cos(angle)+cross(axis,value)*sin(angle)+axis*dot(axis,value)*(1.0-cos(angle));
  }
  float livingWave(float u,float phase,float complexity){
    float longWave=sin(u*6.283185-phase);
    float middleWave=sin(u*12.566371-phase*1.13);
    float shortWave=sin(u*25.132741-phase*.91);
    float middleMix=smoothstep(.08,.68,complexity);
    float shortMix=smoothstep(.55,1.0,complexity);
    return mix(mix(longWave,middleWave,middleMix),shortWave,shortMix*.72);
  }
  void main(){
    vUv=uv;vNormal=normalize(normalMatrix*normal);
    float surfaceU=vUv.x;
    float brokenClock=mix(uTime,floor((uTime+uErrorSeed)*12.)/12.-uErrorSeed,
      clamp(uErrorDistort*.62+uErrorTear*.48,0.,.88));
    float organismWave=livingWave(surfaceU,uWavePhase-uOffset*.7+uErrorJerk*.42,uWaveComplexity);
    float secondaryWave=sin(surfaceU*12.566371+brokenClock*.31+uOffset*5.3)*.44
      +sin(surfaceU*18.849556-brokenClock*.19+uOffset*2.1)*.31;
    vWave=organismWave;
    vec3 p=position;
    if(uMobius>.5){
      float theta=surfaceU*6.283185;
      vec3 center=vec3(uRibbonRadius*cos(theta),uRibbonRadius*sin(theta),0.0);
      vec3 tangent=normalize(vec3(-sin(theta),cos(theta),0.0));
      vec3 radial=normalize(vec3(cos(theta),sin(theta),0.0));
      vec3 offset=p-center;
      float irregularBreath=sin(surfaceU*6.283185+brokenClock*.41+uOffset*8.0)*.56
        +sin(surfaceU*12.566371-brokenClock*.23+uOffset*3.0)*.29
        +sin(surfaceU*18.849556+brokenClock*.13+uOffset*11.0)*.15;
      float widthScale=1.0+uWidthVariation*irregularBreath+organismWave*uWaveAmplitude*1.42;
      offset*=max(.7,widthScale);
      float localTwist=uTwist*(sin(surfaceU*12.566371+brokenClock*.29+uOffset*7.0)
        +secondaryWave*.48+organismWave*.46);
      offset=rotateAroundAxis(offset,tangent,localTwist);
      float activity=smoothstep(.62,1.0,uEnergy);
      float radialFlex=uDeformation*(secondaryWave*.28+sin(surfaceU*6.283185-brokenClock*.17+uOffset)*.12)
        +organismWave*uWaveAmplitude*(.18+activity*.12);
      center+=radial*radialFlex;
      // The readable below/above bend is deliberately strongest in WORK and ERROR.
      center.z+=uDeformation*sin(surfaceU*12.566371-brokenClock*.21+uOffset*9.0)*(.45+activity*.85);
      center.z+=organismWave*uWaveAmplitude*activity*1.35;
      float damageField=smoothstep(.22,.88,sin(surfaceU*31.415926+uErrorSeed*2.7+uOffset*9.)*.5+.5);
      float damagePulse=step(.35,sin(brokenClock*7.3+uErrorSeed))*damageField*uGeometryDamage;
      center+=radial*damagePulse*sin(surfaceU*69.115+uErrorSeed)*.24;
      center.z+=damagePulse*sin(surfaceU*43.982+brokenClock*2.1)*.28;
      offset=rotateAroundAxis(offset,tangent,damagePulse*sin(surfaceU*81.68)*1.35);
      p=center+offset;
      float tearZone=step(.42,sin(surfaceU*37.699112+uErrorSeed*3.1+floor(brokenClock*5.)*.73));
      p+=radial*tearZone*uErrorTear*(.055+.07*sin(surfaceU*18.849556+uErrorSeed));
      p+=tangent*tearZone*uErrorTear*uErrorJerk*.045;
      p+=normal*(organismWave*uWaveAmplitude*.3+secondaryWave*uDeformation*.14);
    }else{
      float coreField=sin(position.x*4.7+uTime*.37)*sin(position.y*5.3-uTime*.29);
      float activity=smoothstep(.62,1.0,uEnergy);
      p+=normal*(organismWave*uWaveAmplitude*(.14+activity*.06)
        +coreField*uDeformation*(.12+activity*.05))*(1.-uErrorContainment);
    }
    // The safety shell becomes mechanically still while the failure continues
    // moving underneath it.
    p=mix(p,position,uErrorContainment);
    float rupture=step(.68,sin((surfaceU+vUv.y*.125)*50.265482+uWavePhase*5.0))
      *uGlitch*uGlitch*(1.-uErrorContainment)*(.1+uErrorTear*.09)*sin(brokenClock*31.0+uOffset*13.0);
    float brokenWave=sin(surfaceU*25.132741-uWavePhase*3.2+uOffset*4.0)
      *step(.05,sin(surfaceU*50.265482+floor(brokenClock*10.0)*1.7));
    p+=normal*(rupture+brokenWave*uGlitch*(1.-uErrorContainment)*.085);
    p.z+=brokenWave*uGlitch*(1.-uErrorContainment)*.065;
    vPos=p;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
  }
`;

export const fragmentShader=/* glsl */`
  uniform float uTime,uEnergy,uGlitch,uMobius,uOffset;
  uniform vec2 uGrid;
  uniform float uWavePhase,uWaveAmplitude,uWaveComplexity,uDigitScale,uDigitDensity;
  uniform float uGradientPhase,uDigitPhase;
  uniform float uErrorDistort,uErrorTear,uErrorCollapse,uErrorEject,uErrorContainment,uErrorJerk,uErrorSeed;
  uniform float uVisibility,uRgbSplit,uSaturation;
  uniform float uErrorStructure,uMissingData,uGradientDamage;
  varying vec2 vUv;
  varying vec3 vPos,vNormal;
  varying float vWave;

  float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
  float boxSdf(vec2 p,vec2 b){vec2 d=abs(p)-b;return length(max(d,0.0))+min(max(d.x,d.y),0.0);}
  float zeroGlyph(vec2 p){vec2 q=p-.5;float ring=abs(length(q*vec2(.86,1.0))-.285);return 1.0-smoothstep(.045,.088,ring);}
  float oneGlyph(vec2 p){
    vec2 q=p-.5;
    float stem=boxSdf(q,vec2(.057,.31));
    float top=boxSdf(q-vec2(0.,.30),vec2(.15,.048));
    float bottom=boxSdf(q+vec2(0.,.30),vec2(.15,.048));
    return 1.0-smoothstep(.015,.052,min(stem,min(top,bottom)));
  }
  float livingWave(float u,float phase,float complexity){
    float a=sin(u*6.283185-phase),b=sin(u*12.566371-phase*1.13),c=sin(u*25.132741-phase*.91);
    return mix(mix(a,b,smoothstep(.08,.68,complexity)),c,smoothstep(.55,1.,complexity)*.72);
  }
  float glyphFor(vec2 local,vec2 cell,float phase,float scale){
    float clock=phase+hash21(cell)*1.73;
    float epoch=floor(clock),rewrite=smoothstep(.64,.94,fract(clock));
    float bitA=step(.5,hash21(cell+epoch+uOffset*17.0));
    float bitB=step(.5,hash21(cell+epoch+1.0+uOffset*17.0));
    vec2 glyphUv=(local-.5)/max(.68,scale)+.5;
    float a=mix(zeroGlyph(glyphUv),oneGlyph(glyphUv),bitA);
    float b=mix(zeroGlyph(glyphUv),oneGlyph(glyphUv),bitB);
    return mix(a,b,rewrite);
  }
  vec3 palette(float t){
    vec3 black=vec3(.012,.008,.025),darkGray=vec3(.12,.115,.145),gray=vec3(.46,.45,.51);
    vec3 white=vec3(.98,.98,1.),pink=vec3(1.,.08,.49),purple=vec3(.34,.07,1.);
    float q=fract(t)*6.;
    if(q<1.)return mix(black,darkGray,smoothstep(0.,1.,q));
    if(q<2.)return mix(darkGray,gray,smoothstep(0.,1.,q-1.));
    if(q<3.)return mix(gray,white,smoothstep(0.,1.,q-2.));
    if(q<4.)return mix(white,pink,smoothstep(0.,1.,q-3.));
    if(q<5.)return mix(pink,purple,smoothstep(0.,1.,q-4.));
    return mix(purple,black,smoothstep(0.,1.,q-5.));
  }
  void main(){
    vec2 surfaceUv=vUv;
    float outerGlitch=uGlitch*(1.-uErrorContainment);
    float wave=.5+.5*livingWave(surfaceUv.x,uWavePhase-uOffset*.7,uWaveComplexity);
    vec2 drift=vec2(-uDigitPhase*5.8,0.0);

    vec2 normalUv=surfaceUv*uGrid+drift;
    vec2 normalRaw=floor(normalUv),normalLocal=fract(normalUv);
    vec2 normalCell=vec2(mod(normalRaw.x,uGrid.x),min(normalRaw.y,uGrid.y-1.-normalRaw.y));
    float pulse=sin(uDigitPhase*.73+hash21(normalCell)*6.283185)*.035;
    float scale=uDigitScale*(1.+(uDigitDensity-1.)*.72+(wave-.5)*uWaveAmplitude*2.25+pulse);
    float normalGlyph=glyphFor(normalLocal,normalCell,uDigitPhase,scale);

    vec2 errorGrid=max(floor(uGrid*.2+.5),vec2(1.));
    vec2 errorUv=surfaceUv*errorGrid+drift*.2;
    vec2 errorRaw=floor(errorUv),errorLocal=fract(errorUv);
    vec2 errorCell=vec2(mod(errorRaw.x,errorGrid.x),min(errorRaw.y,errorGrid.y-1.-errorRaw.y));
    float errorGlyph=glyphFor(errorLocal,errorCell,uDigitPhase*1.17,scale*1.08);
    float structureMix=uErrorStructure*(1.-uErrorContainment);
    float glyph=mix(normalGlyph,errorGlyph,structureMix);
    float localDamage=smoothstep(.28,.9,sin(surfaceUv.x*31.415926+uErrorSeed*2.7+uOffset*9.)*.5+.5);
    float tearZone=step(.38,sin(surfaceUv.x*37.699112+uErrorSeed*3.1+floor(uTime*5.)*.73))
      *step(.42,hash21(errorCell+floor(uTime*3.)));
    glyph*=1.-tearZone*uErrorTear*.92;
    float missingZone=localDamage*step(.5,hash21(errorCell+floor(uTime*.9)+uErrorSeed));
    glyph*=1.-missingZone*uMissingData*.98;

    float channelShift=.075+.055*sin(uTime*13.+uErrorSeed);
    float redGlyph=glyphFor(fract(errorLocal+vec2(channelShift,0.)),errorCell,uDigitPhase*1.17,scale*1.08);
    float blueGlyph=glyphFor(fract(errorLocal-vec2(channelShift,0.)),errorCell,uDigitPhase*1.17,scale*1.08);

    float flow=surfaceUv.x-uGradientPhase+abs(surfaceUv.y-.5)*.20
      +sin(vPos.z*3.2-uWavePhase*.35)*.055+uOffset;
    vec3 smoothColor=palette(flow);
    vec3 brokenColor=palette(floor(fract(flow)*4.)/4.+step(.5,hash21(errorCell))*.21);
    float glitchBlock=step(.04,sin(surfaceUv.x*50.265482+floor((uTime+uErrorJerk*.08)*11.)*1.73+hash21(errorCell)*2.4));
    float fracture=clamp(outerGlitch*(.38+glitchBlock*.82),0.,1.);
    float localFracture=clamp(fracture+uGradientDamage*localDamage,0.,1.);
    vec3 color=mix(smoothColor,brokenColor,localFracture);
    float corrupt=step(.76,hash21(errorCell+uErrorSeed))*uGradientDamage*localDamage;
    color=mix(color,mix(vec3(.98),vec3(1.,.015,.48),step(.5,hash21(errorCell*1.7))),corrupt);
    color=mix(max(color,vec3(.05,.022,.073)),color,outerGlitch);
    color=mix(color,vec3(.56,.52,.69),uErrorContainment*.34);
    float fresnel=pow(1.-abs(dot(normalize(vNormal),vec3(0.,0.,1.))),2.);
    float waveGlow=1.+wave*uWaveAmplitude*(2.35+uEnergy);
    float glitchVisibility=mix(1.,.28+glitchBlock*.72,outerGlitch*.82);
    float split=clamp(uRgbSplit*(1.-uErrorContainment),0.,1.);
    vec3 channelMask=mix(vec3(glyph),vec3(redGlyph,glyph,blueGlyph),split);
    float mask=max(channelMask.r,max(channelMask.g,channelMask.b));
    float alpha=mask*(.78+fresnel*.19)*waveGlow*glitchVisibility*uVisibility;
    if(alpha<.025)discard;
    vec3 stableRgb=color*(.84+uEnergy*.25+fresnel*.38)*waveGlow;
    vec3 splitRgb=vec3(color.r*channelMask.r,color.g*channelMask.g,color.b*channelMask.b)
      *(1.08+uEnergy*.3+fresnel*.34)*waveGlow;
    vec3 finalColor=mix(stableRgb,splitRgb,split);
    float luminance=dot(finalColor,vec3(.2126,.7152,.0722));
    finalColor=mix(vec3(luminance),finalColor,uSaturation);
    gl_FragColor=vec4(finalColor,min(alpha,1.));
  }
`;

export const particleVertexShader=/* glsl */`
  attribute float aSeed;
  uniform float uTime,uIntensity,uTear,uCollapse,uEject,uContainment,uErrorSeed,uPixelRatio;
  varying float vAlpha,vBit,vHue;
  float hash11(float p){return fract(sin(p*127.1)*43758.5453);}
  void main(){
    float random=hash11(aSeed+uErrorSeed);
    float life=fract(uTime*(.16+random*.11)+aSeed+uErrorSeed*.07);
    float envelope=smoothstep(.04,.18,life)*(1.-smoothstep(.68,1.,life));
    vec3 direction=normalize(position+vec3(hash11(aSeed+2.1)-.5,hash11(aSeed+4.7)-.5,hash11(aSeed+8.3)-.5));
    vec3 tangent=normalize(cross(direction,vec3(0.,0.,1.)+vec3(.001,0.,0.)));
    vec3 p=position;
    p+=direction*uTear*envelope*(.12+random*.55);
    p*=1.-uCollapse*envelope*(.42+random*.42);
    p+=direction*uEject*envelope*(.34+random*.95);
    p+=tangent*sin(uTime*(5.+random*8.)+aSeed*31.)*uIntensity*envelope*.16;
    vec3 chaosAxis=normalize(vec3(hash11(aSeed+11.1)-.5,hash11(aSeed+17.4)-.5,hash11(aSeed+23.8)-.5));
    float baseRadius=length(position);
    float innerClock=uTime*(7.+random*11.)+aSeed*41.+uErrorSeed;
    float compressedRadius=baseRadius*(.12+random*.58);
    float internalBurst=pow(.5+.5*sin(innerClock*.43+random*9.),7.);
    vec3 inner=direction*compressedRadius*(.58+.18*sin(innerClock)+internalBurst*.34)
      +tangent*baseRadius*.17*sin(innerClock*1.37)
      +chaosAxis*baseRadius*.11*cos(innerClock*.79);
    float maxInner=baseRadius*.78;
    inner*=min(1.,maxInner/max(length(inner),.001));
    p=mix(p,inner,uContainment);
    vec4 mv=modelViewMatrix*vec4(p,1.);
    gl_Position=projectionMatrix*mv;
    gl_PointSize=(4.5+envelope*7.+uEject*5.+uContainment*(3.+internalBurst*5.))
      *uPixelRatio*clamp(7./-mv.z,.55,1.5);
    float activeAlpha=uIntensity*envelope*(.35+uTear*.75+uCollapse*.55+uEject*.9);
    float containedAlpha=uContainment*(.38+random*.42+internalBurst*.35);
    vAlpha=max(activeAlpha,containedAlpha);
    vBit=step(.5,hash11(aSeed*17.));
    vHue=fract(hash11(aSeed*29.+uErrorSeed)+uContainment*(uTime*.19+internalBurst*.31));
  }
`;

export const containmentVertexShader=/* glsl */`
  uniform float uTime,uIntensity,uSeed;
  varying vec3 vObjectPos,vNormal;
  varying float vPressure;
  void main(){
    float field=sin(position.x*19.+uTime*5.7+uSeed)
      *sin(position.y*23.-uTime*7.1)+sin(position.z*31.+uTime*9.3)*.55;
    vPressure=.5+.5*field;
    vec3 p=position+normal*field*.045*uIntensity;
    vObjectPos=p;vNormal=normalize(normalMatrix*normal);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
  }
`;

export const containmentFragmentShader=/* glsl */`
  uniform float uTime,uIntensity,uSeed;
  varying vec3 vObjectPos,vNormal;
  varying float vPressure;
  float hash31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
  void main(){
    vec3 q=vObjectPos*18.;
    float scroll=sin(q.x+uTime*8.7+sin(q.z-uTime*4.1)*2.4)
      +sin(q.y*1.31-uTime*11.3+sin(q.x+uTime*3.7)*1.8)
      +sin(q.z*1.73+uTime*6.9);
    float blocks=step(.46,hash31(floor(q*1.7)+floor(uTime*9.)+uSeed));
    float pulse=pow(.5+.5*sin(uTime*13.7+hash31(floor(q))*12.),5.);
    vec3 pink=vec3(1.,.025,.46),cyan=vec3(.04,.72,1.),purple=vec3(.38,.015,1.);
    vec3 color=mix(purple,pink,.5+.5*sin(scroll+uTime*2.1));
    color=mix(color,cyan,blocks*(.3+.55*pulse));
    color+=vec3(1.,.3,.72)*pulse*.42;
    float fresnel=pow(1.-abs(dot(normalize(vNormal),vec3(0.,0.,1.))),2.);
    float alpha=uIntensity*(.2+vPressure*.28+blocks*.18+pulse*.22+fresnel*.12);
    gl_FragColor=vec4(color*(.78+pulse*.65),alpha);
  }
`;

export const coreChaosVertexShader=/* glsl */`
  attribute float aSeed;
  uniform float uTime,uIntensity,uVisibility,uPixelRatio;
  varying float vAlpha,vBit,vHue;
  float hash11(float p){return fract(sin(p*127.1)*43758.5453);}
  mat2 rotate2d(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
  void main(){
    float random=hash11(aSeed*17.13);
    vec3 direction=normalize(position+vec3(.0001));
    // During the CALM -> WORK morph, binary matter leaves the spherical
    // surface and becomes several independently moving clocks.
    vec3 shell=direction*.51;
    vec3 chaos=position;
    chaos.xy*=rotate2d(uTime*(1.7+random*3.8)+aSeed*19.);
    chaos.yz*=rotate2d(-uTime*(2.3+hash11(aSeed+4.2)*4.7)+aSeed*31.);
    float burst=pow(.5+.5*sin(uTime*(7.+random*13.)+aSeed*71.),8.);
    vec3 tangent=normalize(cross(direction,vec3(.13,.71,1.)));
    chaos+=tangent*sin(uTime*(5.+random*9.)+aSeed*43.)*(.035+random*.075);
    chaos+=direction*burst*(.025+random*.09);
    chaos*=min(1.,.49/max(length(chaos),.001));
    vec3 p=mix(shell,chaos,smoothstep(.05,.9,uIntensity));
    vec4 mv=modelViewMatrix*vec4(p,1.);
    gl_Position=projectionMatrix*mv;
    gl_PointSize=(2.5+random*2.8+burst*2.)*uPixelRatio*clamp(7./-mv.z,.62,1.45);
    vAlpha=uVisibility*(.34+random*.42+burst*.28);
    vBit=step(.5,hash11(aSeed*29.7));
    vHue=fract(hash11(aSeed*47.1)+uTime*(.08+random*.16)+burst*.23);
  }
`;

export const particleFragmentShader=/* glsl */`
  varying float vAlpha,vBit,vHue;
  float boxSdf(vec2 p,vec2 b){vec2 d=abs(p)-b;return length(max(d,0.))+min(max(d.x,d.y),0.);}
  void main(){
    vec2 p=gl_PointCoord-.5;
    float zero=1.-smoothstep(.055,.11,abs(length(p*vec2(.86,1.))-.285));
    float stem=boxSdf(p,vec2(.065,.31));
    float caps=min(boxSdf(p-vec2(0.,.3),vec2(.16,.05)),boxSdf(p+vec2(0.,.3),vec2(.16,.05)));
    float one=1.-smoothstep(.018,.06,min(stem,caps));
    float glyph=mix(zero,one,vBit);
    if(glyph<.04||vAlpha<.015)discard;
    vec3 pink=vec3(1.,.04,.52),cyan=vec3(.15,.8,1.),purple=vec3(.43,.08,1.);
    vec3 color=mix(mix(pink,cyan,step(.66,vHue)),purple,step(.83,vHue));
    gl_FragColor=vec4(color*1.35,glyph*vAlpha);
  }
`;
