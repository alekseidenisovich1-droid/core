export const vertexShader=/* glsl */`
  uniform float uTime,uEnergy,uGlitch,uMobius,uOffset,uRibbonRadius;
  uniform float uWavePhase,uWaveAmplitude,uWaveComplexity,uDeformation,uWidthVariation,uTwist;
  uniform float uErrorDistort,uErrorTear,uErrorCollapse,uErrorEject,uErrorContainment,uErrorJerk,uErrorSeed;
  uniform float uGeometryDamage,uReliefActivity,uWorkRelief,uReliefRatio,uTerrainMorph;
  uniform float uRibbonAbsorption,uRibbonAbsorptionAnchor;
  varying vec2 vUv;
  varying vec3 vPos,vNormal;
  varying float vWave,vViewDepth,vRibbonAbsorption;

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
      // Optional WORK experiment: a living relief whose height-to-radius
      // ratio follows the outer chaos layer rather than a fixed world size.
      float hillClock=brokenClock*(.64+uOffset*.17);
      float hillA=pow(.5+.5*sin(theta*5.-hillClock+sin(theta*2.+hillClock*.37+uOffset*8.)*1.25),4.);
      float hillB=pow(.5+.5*sin(theta*7.+hillClock*.71+uOffset*13.),3.);
      float livingRelief=hillA*.9-hillB*.3+sin(theta*11.-hillClock*1.17)*.08;
      p+=normal*livingRelief*uRibbonRadius*uReliefRatio*uReliefActivity*uWorkRelief;
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
    // Terrain topology is transferred along the strip, not by scaling the
    // complete Möbius object. The closest arc enters the compact sink first;
    // the spatial front then consumes both remaining tails of the closed strip.
    float absorptionArc=abs(fract(surfaceU-uRibbonAbsorptionAnchor+.5)-.5)*2.;
    float absorptionFront=uRibbonAbsorption*1.16-.08;
    vRibbonAbsorption=(1.-smoothstep(absorptionFront-.105,absorptionFront+.105,absorptionArc))
      *step(.5,uMobius)*step(.001,uRibbonAbsorption);
    float suctionZone=smoothstep(.0,1.,vRibbonAbsorption);
    float sinkRipple=sin(surfaceU*31.415926+uOffset*17.)*.018*(1.-suctionZone);
    vec3 sinkTarget=normalize(p+vec3(.001))*max(.035,.105+sinkRipple);
    p=mix(p,sinkTarget,suctionZone);
    // The safety shell becomes mechanically still while the failure continues
    // moving underneath it.
    p=mix(p,position,uErrorContainment);
    float rupture=step(.68,sin((surfaceU+vUv.y*.125)*50.265482+uWavePhase*5.0))
      *uGlitch*uGlitch*(1.-uErrorContainment)*(.1+uErrorTear*.09)*sin(brokenClock*31.0+uOffset*13.0);
    float brokenWave=sin(surfaceU*25.132741-uWavePhase*3.2+uOffset*4.0)
      *step(.05,sin(surfaceU*50.265482+floor(brokenClock*10.0)*1.7));
    p+=normal*(rupture+brokenWave*uGlitch*(1.-uErrorContainment)*.085);
    p.z+=brokenWave*uGlitch*(1.-uErrorContainment)*.065;
    // All legacy topologies converge on the future TERRAIN plane. Ribbons
    // flatten and spread laterally; Kernel matter expands from its compact
    // volume. The field begins appearing before this projection completes.
    float terrainLocal=smoothstep(.02,.98,uTerrainMorph
      +(sin(surfaceU*31.416+uOffset*19.)*.5+.5-.5)*.055);
    vec3 terrainPlane=uMobius>.5
      ?vec3(p.x*1.18+sin(surfaceU*18.85+uOffset*11.)*.28,0.,p.y*.72+(uOffset-.23)*4.2)
      :vec3(p.x*3.6,0.,p.y*2.8+p.z*1.7);
    p=mix(p,terrainPlane,terrainLocal);
    vPos=p;
    vec4 mvPosition=modelViewMatrix*vec4(p,1.0);
    vViewDepth=-mvPosition.z;
    gl_Position=projectionMatrix*mvPosition;
  }
`;

export const fragmentShader=/* glsl */`
  uniform float uTime,uEnergy,uGlitch,uMobius,uOffset;
  uniform vec2 uGrid;
  uniform float uWavePhase,uWaveAmplitude,uWaveComplexity,uDigitScale,uDigitDensity;
  uniform float uGradientPhase,uDigitPhase;
  uniform float uErrorDistort,uErrorTear,uErrorCollapse,uErrorEject,uErrorContainment,uErrorJerk,uErrorSeed;
  uniform float uVisibility,uRgbSplit,uSaturation,uDepthFade;
  uniform float uErrorStructure,uMissingData,uGradientDamage;
  varying vec2 vUv;
  varying vec3 vPos,vNormal;
  varying float vWave,vViewDepth,vRibbonAbsorption;

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
    float unabsorbed=1.-smoothstep(.64,.995,vRibbonAbsorption);
    float alpha=mask*(.78+fresnel*.19)*waveGlow*glitchVisibility*uVisibility*unabsorbed;
    if(alpha<.025)discard;
    vec3 stableRgb=color*(.84+uEnergy*.25+fresnel*.38)*waveGlow;
    vec3 splitRgb=vec3(color.r*channelMask.r,color.g*channelMask.g,color.b*channelMask.b)
      *(1.08+uEnergy*.3+fresnel*.34)*waveGlow;
    vec3 finalColor=mix(stableRgb,splitRgb,split);
    // Subtle true view-depth cue; this is deliberately not a fog overlay.
    float depthFade=1.0-smoothstep(8.2,13.4,vViewDepth)*uDepthFade;
    finalColor*=depthFade;
    float luminance=dot(finalColor,vec3(.2126,.7152,.0722));
    finalColor=mix(vec3(luminance),finalColor,uSaturation);
    gl_FragColor=vec4(finalColor,min(alpha*mix(1.,.82,uDepthFade),1.));
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
  uniform float uTime,uIntensity,uSeed,uLayer,uLiving,uCompression,uSeedMorph,uTerrainMorph,uFillProgress;
  uniform vec3 uSeedCenter;
  varying vec3 vObjectPos,vNormal;
  varying float vPressure;
  float hash41(vec3 p,float epoch){
    return fract(sin(dot(p,vec3(127.1,311.7,74.7))+epoch*91.17+uSeed*53.3)*43758.5453);
  }
  float valueNoise(vec3 p,float epoch){
    vec3 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    float n000=hash41(cell+vec3(0,0,0),epoch),n100=hash41(cell+vec3(1,0,0),epoch);
    float n010=hash41(cell+vec3(0,1,0),epoch),n110=hash41(cell+vec3(1,1,0),epoch);
    float n001=hash41(cell+vec3(0,0,1),epoch),n101=hash41(cell+vec3(1,0,1),epoch);
    float n011=hash41(cell+vec3(0,1,1),epoch),n111=hash41(cell+vec3(1,1,1),epoch);
    float z0=mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y);
    float z1=mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y);
    return mix(z0,z1,f.z);
  }
  void main(){
    vec3 direction=normalize(position+vec3(.0001));
    // Exact original Git displacement formula. The static field at t=0 is
    // retained as a permanent reference mode for CHAOS OFF.
    float originalField=sin(position.x*19.)*sin(position.y*23.)+sin(position.z*31.)*.55;
    float field=sin(position.x*19.+uTime*5.7+uSeed)
      *sin(position.y*23.-uTime*7.1)+sin(position.z*31.+uTime*9.3)*.55;
    // A continuously changing spatial mask keeps about half of the regions at
    // full original relief while the other half settles onto the base sphere.
    float maskClock=uTime*(.28+uLayer*.035);
    float epoch=floor(maskClock),transition=smoothstep(.12,.88,fract(maskClock));
    vec3 maskPosition=direction*(4.2+uLayer*.7)+uSeed*3.1;
    float oldMask=valueNoise(maskPosition,epoch);
    float newMask=valueNoise(maskPosition,epoch+1.);
    float activity=smoothstep(.44,.56,mix(oldMask,newMask,transition));
    float livingField=field*activity;
    float activeField=mix(originalField,livingField,uLiving);
    vPressure=.5+.5*activeField;
    vec3 compressed=position*(1.-uCompression*.48)
      +normal*activeField*.045*uIntensity*(1.-uCompression*.72)*mix(.18,1.,uFillProgress);
    float maxAxis=max(max(abs(direction.x),abs(direction.y)),abs(direction.z));
    float seedHalf=mix(.118,.078,uLayer);
    vec3 cubeSurface=uSeedCenter+direction/max(maxAxis,.001)*seedHalf;
    // Local phase offsets keep the topology change from reading as a single
    // uniform scale while all vertices still converge on the same seed cell.
    float localMorph=smoothstep(.02,.98,uSeedMorph+activeField*.035);
    vec3 p=mix(compressed,cubeSurface,localMorph);
    vec3 terrainPlane=vec3(p.x*4.1,0.,p.y*2.7+p.z*2.2);
    p=mix(p,terrainPlane,smoothstep(.02,.98,uTerrainMorph+activeField*.035));
    vObjectPos=p;vNormal=normalize(normalMatrix*normal);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
  }
`;

export const containmentFragmentShader=/* glsl */`
  uniform float uTime,uIntensity,uSeed,uLayer,uMatterRemaining,uConversion,uFillProgress,uTerrainWarm;
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
    vec3 layerBase=mix(purple,pink,uLayer*.56);
    vec3 color=mix(layerBase,pink,.28+.34*sin(scroll+uTime*2.1));
    color=mix(color,cyan,blocks*(.18+.42*pulse)*(1.-uLayer*.35));
    color+=vec3(1.,.3,.72)*pulse*.42;
    // Transition warmth migrates through stable spatial regions instead of
    // replacing the complete Chaos object with a homogeneous yellow sphere.
    float warmRegion=smoothstep(.3,.78,hash31(floor(q*.38)+uSeed*17.)+vPressure*.16);
    vec3 smoked=vec3(.095,.082,.071),warm=vec3(.78,.43,.15);
    vec3 transitionColor=mix(smoked,warm,.22+.5*pulse);
    // A Terrain-owned CHAOS must read as graphite/amber matter rather than a
    // magenta sphere with a few yellow freckles. Spatial variation preserves
    // both living shells and avoids a homogeneous solid-yellow ball.
    float terrainPalette=uTerrainWarm*(.52+.43*warmRegion);
    color=mix(color,transitionColor,terrainPalette);
    // Matter is removed in clustered local regions as its assigned cube cells
    // become structural. This is driven by formed mass, not a global fade.
    float cellNoise=hash31(floor(q*.47)+floor(uTime*.18)+uSeed*11.);
    float retained=smoothstep(1.-uMatterRemaining-.18,1.-uMatterRemaining+.18,cellNoise);
    retained=mix(1.,retained,uConversion);
    vec3 graphite=vec3(.16,.145,.14),silver=vec3(.58,.52,.43);
    color=mix(color,mix(graphite,silver,pulse*.32),uConversion*(.35+.4*cellNoise));
    float fresnel=pow(1.-abs(dot(normalize(vNormal),vec3(0.,0.,1.))),2.);
    float alpha=uIntensity*(.14+vPressure*.24+blocks*.12+pulse*.18+fresnel*.1)*retained
      *mix(.12,1.,uFillProgress)*mix(1.,.72,uTerrainWarm);
    gl_FragColor=vec4(color*(.78+pulse*.65),alpha);
  }
`;

export const coreChaosVertexShader=/* glsl */`
  attribute float aSeed;
  uniform float uTime,uIntensity,uVisibility,uPixelRatio,uCompression,uSeedMorph,uTerrainMorph,uFillProgress;
  uniform float uTransitionWarm;
  uniform vec3 uSeedCenter;
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
    p*=1.-uCompression*.57;
    vec3 cubeDirection=normalize(p+vec3(.0001));
    float maxAxis=max(max(abs(cubeDirection.x),abs(cubeDirection.y)),abs(cubeDirection.z));
    float radialDensity=pow(clamp(length(position)/.51,0.,1.),.72);
    vec3 cubeVolume=uSeedCenter+cubeDirection/max(maxAxis,.001)*(.105*radialDensity);
    float localMorph=smoothstep(.04,.96,uSeedMorph+(random-.5)*.12);
    p=mix(p,cubeVolume,localMorph);
    vec3 terrainPlane=vec3(p.x*4.2,0.,p.y*2.9+p.z*2.1);
    p=mix(p,terrainPlane,smoothstep(.03,.97,uTerrainMorph+(random-.5)*.08));
    vec4 mv=modelViewMatrix*vec4(p,1.);
    gl_Position=projectionMatrix*mv;
    gl_PointSize=(2.5+random*2.8+burst*2.)*(1.+uCompression*.42)*uPixelRatio
      *clamp(7./-mv.z,.62,1.45)*mix(1.,.72,uTransitionWarm);
    float retainedByFill=step(random,uFillProgress);
    vAlpha=uVisibility*(.34+random*.42+burst*.28)*retainedByFill*mix(1.,.58,uTransitionWarm);
    vBit=step(.5,hash11(aSeed*29.7));
    vHue=fract(hash11(aSeed*47.1)+uTime*(.08+random*.16)+burst*.23);
  }
`;

export const particleFragmentShader=/* glsl */`
  uniform float uTransitionWarm;
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
    float warmRegion=smoothstep(.28,.82,fract(vHue*7.13+vBit*.37));
    vec3 transitionColor=mix(vec3(.11,.095,.08),vec3(1.,.48,.13),warmRegion);
    color=mix(color,transitionColor,uTransitionWarm*(.28+.72*warmRegion));
    gl_FragColor=vec4(color*1.35,glyph*vAlpha);
  }
`;

// A compact Terrain-owned point reservoir. It is intentionally made from
// round Terrain-like samples rather than binary glyphs, so it cannot read as
// the ERROR Disco Ball. During the handoff the samples settle onto the two
// Mini Chaos shell targets while those real surfaces become readable.
// Binary matter is topology-agnostic: the cube provides cell centres and this
// layer supplies the 0/1 atoms that can detach and later reconstruct a cell.
export const cubeGlyphVertexShader=/* glsl */`
  attribute vec3 aCell,aOffset;
  attribute float aSeed,aAtom,aBit,aFormationStart,aIsSeed;
  uniform float uTime,uVisibility,uPixelRatio,uPeriod,uDuration,uTransition,uSeedMorph;
  varying float vAlpha,vBit,vHeat;
  void main(){
    float local=fract(uTime/uPeriod+aSeed)*uPeriod;
    float rise=smoothstep(0.,.28,local);
    float fall=1.-smoothstep(uDuration-.3,uDuration,local);
    float active=rise*fall*step(local,uDuration)*(1.-aIsSeed);
    vec3 direction=normalize(vec3(
      sin(aAtom*71.3),cos(aAtom*127.1),sin(aAtom*193.7)+.18
    ));
    vec3 orbit=vec3(sin(uTime*3.1+aAtom*31.),cos(uTime*2.3+aAtom*17.),sin(uTime*2.7+aAtom*43.));
    float crystallize=mix(smoothstep(aFormationStart,aFormationStart+.22,uTransition),uSeedMorph,aIsSeed);
    // Unformed atoms live in the central seed rather than on a temporary
    // sphere. This makes expansion and reverse collection share one path.
    vec3 raw=aOffset*.35+direction*.012;
    vec3 structuralCell=mix(aCell,vec3(0.),aIsSeed);
    vec3 ordered=structuralCell+aOffset+direction*active*(.10+.16*fract(aAtom*19.))
      +orbit*active*.026;
    // Each atom takes its own short path to a locally stabilising cell; this
    // is intentionally not one global sphere-to-cube interpolation.
    // Seed glyphs are already part of the seed cell when they become visible.
    // Bypassing the generic spherical raw path prevents a one-frame digit halo.
    vec3 p=mix(raw,ordered,max(crystallize,aIsSeed));
    vec4 mv=modelViewMatrix*vec4(p,1.);
    gl_Position=projectionMatrix*mv;
    gl_PointSize=(3.1+active*2.5)*uPixelRatio*clamp(8./-mv.z,.58,1.45);
    vAlpha=uVisibility*crystallize*(.65+active*.35);
    vBit=aBit;
    vHeat=clamp(1.-length(aCell)/2.25,0.,1.);
  }
`;

export const cubeGlyphFragmentShader=/* glsl */`
  varying float vAlpha,vBit,vHeat;
  float boxSdf(vec2 p,vec2 b){vec2 d=abs(p)-b;return length(max(d,0.))+min(max(d.x,d.y),0.);}
  void main(){
    vec2 p=gl_PointCoord-.5;
    float zero=1.-smoothstep(.052,.105,abs(length(p*vec2(.84,1.))-.275));
    float stem=boxSdf(p,vec2(.06,.295));
    float cap=min(boxSdf(p-vec2(0.,.285),vec2(.145,.046)),boxSdf(p+vec2(0.,.285),vec2(.145,.046)));
    float one=1.-smoothstep(.016,.052,min(stem,cap));
    float glyph=mix(zero,one,vBit);
    if(glyph<.04||vAlpha<.01)discard;
    vec3 graphite=vec3(.38,.36,.34);
    vec3 ember=vec3(2.4,1.08,.42);
    vec3 color=mix(graphite,ember,pow(vHeat,1.7));
    gl_FragColor=vec4(color,glyph*vAlpha);
  }
`;

export const terrainVertexShader=/* glsl */`
  attribute vec2 aGrid;
  attribute float aSeed,aFormationDelay;
  uniform float uTime,uPresence,uTopologyProgress,uFormationDirection,uTransitionWarm;
  uniform float uPixelRatio,uAmplitude,uMacroFrequency,uMacroSpeed;
  uniform float uMediumStrength,uMediumFrequency,uWaveDirectionCount;
  uniform float uLocalEventFrequency,uLocalEventRadius,uLocalEventStrength,uLocalEventLifetime;
  uniform float uSimulationDamping,uPropagationStrength,uMicroDisplacement;
  uniform float uEdgeFadeStart,uEdgeFadeWidth,uPointDensity,uEmission;
  uniform float uWarmWhiteIntensity,uAmberThreshold,uRedThreshold,uAoStrength,uFogAttenuation;
  uniform vec2 uTerrainHalfSize;
  varying float vAlpha,vBrightness,vActivity,vViewDepth;
  varying vec3 vColor;

  float hash11(float p){return fract(sin(p*127.1)*43758.5453123);}
  float hash31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
  float noise3(vec3 p){
    vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    float n000=hash31(i),n100=hash31(i+vec3(1,0,0));
    float n010=hash31(i+vec3(0,1,0)),n110=hash31(i+vec3(1,1,0));
    float n001=hash31(i+vec3(0,0,1)),n101=hash31(i+vec3(1,0,1));
    float n011=hash31(i+vec3(0,1,1)),n111=hash31(i+vec3(1,1,1));
    return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),
      mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y),f.z);
  }
  float fbm(vec3 p){
    float value=0.,weight=.56;
    for(int i=0;i<4;i++){value+=noise3(p)*weight;p=p*2.03+vec3(7.1,3.7,5.9);weight*=.48;}
    return value;
  }
  float pressureEvent(vec2 p,vec2 center,float radius,float strength,float clock,float asymmetry){
    vec2 q=p-center;
    q.x*=1.+asymmetry*.34;q.y*=1.-asymmetry*.22;
    float distortion=(noise3(vec3(q*.58,clock*.11))-.5)*radius*.32;
    float d=(length(q)+distortion)/max(radius,.05);
    float body=1.-smoothstep(.18,1.,d);
    float shoulder=sin(d*5.4-clock*.47)*exp(-d*2.6)*.16*uPropagationStrength;
    return (body+shoulder)*strength;
  }
  float heightField(vec2 p,float clock){
    float slow=clock*uMacroSpeed;
    float activeClock=clock*1.72;
    float macroRaw=fbm(vec3(p*uMacroFrequency,slow))-.51;
    float macro=sign(macroRaw)*pow(abs(macroRaw)*1.82,1.28);
    float warp=(noise3(vec3(p*.31,slow*.73))-.5)*2.7;
    float medium=0.;
    medium+=sin(dot(p,normalize(vec2(.83,.47)))*uMediumFrequency+warp+activeClock*.137);
    medium+=sin(dot(p,normalize(vec2(-.38,.92)))*uMediumFrequency*1.19-warp*.61-activeClock*.109)
      *step(1.5,uWaveDirectionCount);
    medium+=sin(dot(p,normalize(vec2(.24,-.97)))*uMediumFrequency*.77+warp*1.17+activeClock*.083)
      *step(2.5,uWaveDirectionCount);
    medium+=sin(dot(p,normalize(vec2(-.91,-.42)))*uMediumFrequency*1.43-warp*.83+activeClock*.061)
      *step(3.5,uWaveDirectionCount);
    medium+=sin(dot(p,normalize(vec2(.64,-.77)))*uMediumFrequency*1.71+warp*.47-activeClock*.047)
      *step(4.5,uWaveDirectionCount);
    medium+=sin(dot(p,normalize(vec2(-.72,.69)))*uMediumFrequency*.91-warp*.32+activeClock*.119)
      *step(5.5,uWaveDirectionCount);
    medium+=sin(dot(p,normalize(vec2(.97,.22)))*uMediumFrequency*1.31+warp*.78-activeClock*.073)
      *step(6.5,uWaveDirectionCount);
    medium+=sin(dot(p,normalize(vec2(-.12,-.99)))*uMediumFrequency*1.58-warp*1.04-activeClock*.091)
      *step(7.5,uWaveDirectionCount);
    medium+=sin(dot(p,normalize(vec2(.51,.86)))*uMediumFrequency*.66+warp*.55+activeClock*.157)
      *step(8.5,uWaveDirectionCount);
    medium+=sin(dot(p,normalize(vec2(-.95,.31)))*uMediumFrequency*1.84-warp*.69+activeClock*.052)
      *step(9.5,uWaveDirectionCount);
    medium*=uMediumStrength/sqrt(max(1.,uWaveDirectionCount));

    float eventClock=activeClock/max(uLocalEventLifetime,.5)*uLocalEventFrequency;
    // Three stable left-to-right traversals and three right-to-left. Each wrap
    // is aligned with sin(angle)=-1, where its preserved life envelope is zero,
    // so a live pressure front can never teleport across the field.
    float angle0=eventClock*.71+.4,angle1=eventClock*.57+2.3;
    float angle2=eventClock*.83+4.7,angle3=eventClock*.63+1.8;
    float angle4=eventClock*.77+3.4,angle5=eventClock*.51+5.9;
    float phase0=fract((angle0+1.570796327)/6.283185307);
    float phase1=fract((angle1+1.570796327)/6.283185307);
    float phase2=fract((angle2+1.570796327)/6.283185307);
    float phase3=fract((angle3+1.570796327)/6.283185307);
    float phase4=fract((angle4+1.570796327)/6.283185307);
    float phase5=fract((angle5+1.570796327)/6.283185307);
    float horizontalSpan=uTerrainHalfSize.x*.86;
    vec2 c0=vec2(mix(-horizontalSpan,horizontalSpan,phase0),-1.22+sin(eventClock*.13+.2)*.16);
    vec2 c1=vec2(mix(horizontalSpan,-horizontalSpan,phase1),-.74+sin(eventClock*.11+1.7)*.19);
    vec2 c2=vec2(mix(-horizontalSpan,horizontalSpan,phase2),-.24+sin(eventClock*.09+3.1)*.14);
    vec2 c3=vec2(mix(horizontalSpan,-horizontalSpan,phase3),.26+sin(eventClock*.12+5.4)*.17);
    vec2 c4=vec2(mix(-horizontalSpan,horizontalSpan,phase4),.76+sin(eventClock*.08+2.6)*.2);
    vec2 c5=vec2(mix(horizontalSpan,-horizontalSpan,phase5),1.24+sin(eventClock*.1+.9)*.15);
    float life0=smoothstep(-.72,-.08,sin(eventClock*.71+.4))*(1.-smoothstep(.38,.93,sin(eventClock*.71+.4)));
    float life1=smoothstep(-.8,-.18,sin(eventClock*.57+2.3))*(1.-smoothstep(.34,.91,sin(eventClock*.57+2.3)));
    float life2=smoothstep(-.76,-.12,sin(eventClock*.83+4.7))*(1.-smoothstep(.4,.94,sin(eventClock*.83+4.7)));
    float life3=smoothstep(-.78,-.16,sin(eventClock*.63+1.8))*(1.-smoothstep(.36,.92,sin(eventClock*.63+1.8)));
    float life4=smoothstep(-.74,-.1,sin(eventClock*.77+3.4))*(1.-smoothstep(.42,.95,sin(eventClock*.77+3.4)));
    float life5=smoothstep(-.81,-.2,sin(eventClock*.51+5.9))*(1.-smoothstep(.32,.9,sin(eventClock*.51+5.9)));
    float events=pressureEvent(p,c0,uLocalEventRadius,uLocalEventStrength*life0,eventClock,.7);
    events-=pressureEvent(p,c1,uLocalEventRadius*1.22,uLocalEventStrength*.82*life1,eventClock+3.1,-.48);
    events+=pressureEvent(p,c2,uLocalEventRadius*.76,uLocalEventStrength*.68*life2,eventClock+7.3,.35);
    events-=pressureEvent(p,c3,uLocalEventRadius*1.38,uLocalEventStrength*.62*life3,eventClock+1.7,-.62);
    events+=pressureEvent(p,c4,uLocalEventRadius*.9,uLocalEventStrength*.74*life4,eventClock+5.2,.44);
    events-=pressureEvent(p,c5,uLocalEventRadius*1.08,uLocalEventStrength*.57*life5,eventClock+9.1,.28);
    float micro=(noise3(vec3(p*2.7,activeClock*.12))-.5)*uMicroDisplacement;
    events*=mix(.72,1.08,uSimulationDamping);
    return (macro*.72+medium+events+micro)*uAmplitude;
  }
  void main(){
    float h=heightField(aGrid,uTime);
    float eps=.045;
    float hx=heightField(aGrid+vec2(eps,0),uTime);
    float hz=heightField(aGrid+vec2(0,eps),uTime);
    vec3 tangentX=normalize(vec3(eps,hx-h,0));
    vec3 tangentZ=normalize(vec3(0,hz-h,eps));
    float temporal=abs(heightField(aGrid,uTime+.075)-heightField(aGrid,uTime-.075));
    float activity=clamp(temporal*9.+length(vec2(hx-h,hz-h))*3.2,0.,1.);

    vec2 domainPosition=abs(aGrid)/uTerrainHalfSize;
    // The simulation stays rectangular, while its visible ownership dissolves
    // as a wide irregular oval well before the final rows and columns.
    float edgeCoordinate=length(vec2(domainPosition.x,domainPosition.y*1.34));
    float broadEdgeNoise=(fbm(vec3(aGrid*.18,aSeed*.73))-.5)*.14;
    float fineEdgeNoise=sin(aGrid.x*.71+aGrid.y*.43+aSeed*18.7)*.028;
    float distortedEdge=edgeCoordinate+broadEdgeNoise+fineEdgeNoise;
    float edge=1.-smoothstep(uEdgeFadeStart,uEdgeFadeStart+uEdgeFadeWidth,distortedEdge);
    edge*=1.-smoothstep(.84,.96,edgeCoordinate);
    float densityProbability=uPointDensity*pow(max(edge,0.),.68);
    float densityMask=step(hash11(aSeed*311.7),densityProbability);

    float localProgress=smoothstep(aFormationDelay-.025,aFormationDelay+.055,uTopologyProgress);
    float frontDistance=(uTopologyProgress-aFormationDelay)/.065;
    float frontBand=exp(-frontDistance*frontDistance);
    float frontField=noise3(vec3(aGrid*.19,3.7));
    float transitionFormationImpulse=frontBand*(.58+.3*frontField)
      *uAmplitude*abs(uFormationDirection);
    vec2 sampleJitter=vec2(hash11(aSeed*29.7)-.5,hash11(aSeed*41.3)-.5)*.044;
    // Persistent samples never leave their logical field coordinates. The
    // expanding/collapsing front transfers visibility, height and light only.
    vec3 p=vec3(aGrid.x+sampleJitter.x,h+transitionFormationImpulse,aGrid.y+sampleJitter.y);
    vec4 mv=modelViewMatrix*vec4(p,1.);
    gl_Position=projectionMatrix*mv;
    vActivity=activity;vViewDepth=-mv.z;

    float heightLight=smoothstep(-.34,.62,h);
    float information=pow(hash11(aSeed*173.9),3.35)*(.42+.58*heightLight);
    float warmSignal=smoothstep(uAmberThreshold,1.,activity*1.08+heightLight*.18);
    float redSignal=smoothstep(uRedThreshold,1.,activity)*step(.985,hash11(aSeed*997.));
    vec3 graphite=mix(vec3(.055,.058,.056),vec3(.32,.325,.30),information);
    vec3 ivory=vec3(.88,.845,.75)*uWarmWhiteIntensity;
    vec3 amber=vec3(.72,.43,.16);
    vec3 vermilion=vec3(.72,.14,.075);
    vec3 color=mix(graphite,ivory,information*(.22+.34*heightLight));
    color=mix(color,amber,warmSignal*.58);color=mix(color,vermilion,redSignal);
    float transitionWarmRegion=smoothstep(.3,.78,frontField+information*.16);
    vec3 transitionWarmColor=mix(graphite,amber,.22+.4*transitionWarmRegion);
    float transitionWarmInfluence=uTransitionWarm*frontBand*(.58+.42*transitionWarmRegion);
    color=mix(color,transitionWarmColor,transitionWarmInfluence*.78);
    float valleyAo=mix(1.,.52,(1.-smoothstep(-.62,.05,h))*uAoStrength);
    float edgeEnergy=smoothstep(0.,.7,edge);
    vColor=color*valleyAo*uEmission*mix(.08,1.,edgeEnergy);
    vBrightness=clamp((information*.48+warmSignal*.68+redSignal
      +frontBand*abs(uFormationDirection)*.62)*edgeEnergy,0.,1.);
    float distanceFade=exp(-max(0.,vViewDepth-5.2)*uFogAttenuation);
    float farDensity=mix(1.,.38,smoothstep(5.8,11.5,vViewDepth));
    float formed=smoothstep(.015,.16,localProgress);
    vAlpha=uPresence*edge*densityMask*distanceFade*farDensity*formed;
    float perspectiveSize=3.1*uPixelRatio*(3.9/max(2.2,vViewDepth));
    float edgeSize=mix(.28,1.,smoothstep(0.,.72,edge));
    float distanceSize=mix(1.,.62,smoothstep(5.5,11.5,vViewDepth));
    gl_PointSize=clamp(perspectiveSize*edgeSize*distanceSize,.55*uPixelRatio,3.2*uPixelRatio);
  }
`;

export const terrainFragmentShader=/* glsl */`
  uniform float uBloomThreshold,uBloomStrength,uBloomRadius,uExposure;
  varying float vAlpha,vBrightness,vActivity,vViewDepth;
  varying vec3 vColor;
  void main(){
    vec2 p=gl_PointCoord-.5;
    float distanceToPoint=length(p*vec2(.96,1.));
    float pointCore=1.-smoothstep(.23,.49,distanceToPoint);
    float bloomGate=smoothstep(uBloomThreshold,1.,vBrightness);
    float halo=(1.-smoothstep(.18,.5,distanceToPoint))*bloomGate*uBloomStrength*.09;
    float alpha=vAlpha*max(pointCore,halo);
    if(alpha<.008||distanceToPoint>.5)discard;
    vec3 color=vColor*(.72+vBrightness*.76+vActivity*.18)*uExposure;
    color+=vColor*halo*(1.1+uBloomRadius*.4);
    gl_FragColor=vec4(color,alpha);
  }
`;
