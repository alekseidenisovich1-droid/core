# CORE — зависимости визуала

> Актуально для runtime-реализации после архитектурной стабилизации переходов и ownership от 2026-08-30.
> Источник истины — фактически отрисованный результат, затем `src/visual.ts`, `src/shaders.ts` и `src/config.ts`.

Документ написан в Markdown UTF-8 и пригоден для чтения ChatGPT. Здесь зафиксированы визуальные сущности, владельцы материи, формулы, переходы, конечные точки и защищённые инварианты.

## 1. Визуальный словарь

### CHAOS

`CHAOS` — только две вложенные живые деформируемые оболочки:

- `containmentChaos.children[0]` — внешняя полупрозрачная `Mesh<SphereGeometry>`;
- `containmentChaos.children[1]` — внутренняя полупрозрачная `Mesh<IcosahedronGeometry>`.

Обе используют `containmentVertexShader` / `containmentFragmentShader`. Kernel, бинарные точки и ERROR-debris в CHAOS не входят.

### DISCO BALL

`DISCO BALL` — дополнительная сферическая/бинарная структура вокруг CHAOS в ERROR-подобной конфигурации:

- сферический Kernel из бинарных глифов (`this.core`);
- 640 бинарных точек `containmentChaos.children[2]`;
- окружающие ERROR/containment-частицы лент.

`DISCO BALL ≠ CHAOS`. Disco Ball не является универсальным транспортным объектом и не участвует в переходах TERRAIN.

### MINI CHAOS

`MINI CHAOS` — те же две оболочки CHAOS с масштабом `0.5` от нормального WORK-размера. Это не новый объект. В нём нет Kernel, бинарной сферы и ERROR-debris.

### Компактный тёплый CHAOS

При обратном переходе из TERRAIN отдельного point core больше нет. Материя фронта сразу проявляет две настоящие оболочки CHAOS:

- для состояний 1–5 — `0.5 ×` нормального WORK-размера;
- для CUBE — размер согласован с одним Seed Cube;
- палитра — тёмный графит с пространственно неоднородной янтарной энергией;
- Kernel и 640 бинарных точек Disco Ball отсутствуют.

## 2. Состояния и главный кадр

`TransitionController` отдельно хранит запрошенное и фактически установленное состояние, один активный transition primitive и типизированный handoff. `CoreVisual.update(dt)` обновляет локальные Cube/Terrain-фазы, получает единый `VisualOwnershipSnapshot`, передаёт GPU-uniforms, применяет visibility один раз и рендерит композицию.

Клавиши `1…7` выбирают:

1. `CALM`;
2. `WORK`;
3. `ERROR`;
4. `CRITICAL`;
5. `CRITICAL_2`;
6. `CUBE`;
7. `TERRAIN`.

Финальные визуалы 1–6 не изменены. Переходные объекты имеют право на пиксели только во время своей фазы.

## 3. Постоянные сущности

### Kernel и ленты

Kernel — сферическая поверхность из бинарных глифов. Три ленты Мёбиуса имеют собственные радиусы, фазы, ширину, деформацию, ghost-слои и ERROR-частицы.

### CUBE

Решётка `8 × 8 × 8`. Принятая хореография сохранена:

```text
source → kernelHold → seed → expand → idle
idle → collapseCube → collapseSeed → inactive
```

### TERRAIN

Постоянная GPU-сетка `240 × 180 = 43 200` точек. Каждая точка всегда закреплена за своей логической X/Z. Переходы не выполняют `mix(centerPosition, finalPosition)`.

World-space размер:

```text
width = 14
depth = 6
```

Ширина сохранена, глубина уменьшена вдвое с 12 до 6. При неизменных 180 строках шаг по Z стал вдвое плотнее. В runtime это не создаёт читаемого прямоугольного края, поэтому число точек не менялось.

## 4. Высота и цвет TERRAIN

`heightField()` и `pressureEvent()` сохранены:

```text
H = amplitude × (0.72 × macro + medium + waves + micro)
```

- `macro` — четырёхоктавная FBM-деформация;
- `medium` — до девяти непараллельных интерференционных направлений;
- `waves` — шесть независимых `pressureEvent`;
- `micro` — малая высокочастотная нерегулярность.

Pressure-системы могут визуально пересекаться, но не сталкиваются, не поглощают друг друга и не передают скорость.

В `TERRAIN idle` действует прежний `warmSignal`. Янтарный цвет зависит главным образом от скорости изменения высоты и наклона; абсолютная высота влияет слабее. Поэтому точки желтеют не просто на «верхней границе», хотя гребни часто совпадают с этим сигналом.

Во время перехода добавляется локальный `frontBand`; после завершения его вклад равен нулю.

## 5. Шесть горизонтальных pressure-систем

```text
eventClock = activeClock / localEventLifetime × localEventFrequency
localEventFrequency = 1.25
```

Форма, сила, знак и life-envelope `pressureEvent()` не менялись. Изменены только центры `c0…c5`:

```text
phase = fract((angle + π/2) / 2π)
xLR = mix(-0.86 × halfWidth, +0.86 × halfWidth, phase)
xRL = -xLR
```

- `c0`, `c2`, `c4`: преимущественно слева направо;
- `c1`, `c3`, `c5`: преимущественно справа налево;
- Z — вторичные полосы около `-1.22, -0.74, -0.24, 0.26, 0.76, 1.24`;
- малый Z-дрейф: примерно `0.14…0.20`;
- wrap происходит при почти нулевом life-вкладе, без видимого телепорта.

Чередование давления сохранено:

```text
+ c0 - c1 + c2 - c3 + c4 - c5
```

## 6. Растворение границы TERRAIN

Прямоугольная сетка скрыта широкой эллиптической метрикой:

```text
normalizedX = x / halfWidth
normalizedZ = z / halfDepth
edgeCoordinate = length(vec2(normalizedX, 1.34 × normalizedZ))
```

Граница растворяется через стабильное low-frequency искажение, `edgeFadeStart` / `edgeFadeWidth`, детерминированное разрежение, уменьшение point size, alpha/emission и fog attenuation. Это не меняет высоту волн.

## 7. Пространственное поглощение лент

Git-аудит не нашёл в доступной истории прежнего per-vertex suction. Старые версии использовали глобальное уменьшение:

```text
scale = mix(activeScale, containedScale, containment)
visibility *= 1 - 0.995 × containment
particlePosition = mix(position, innerPosition, containment)
```

Поэтому spatial-механизм добавлен локально без возврата старых rotation-багов. Для каждой ленты используется стабильный anchor в UV-параметризации:

```text
arc = abs(fract(surfaceU - anchor + 0.5) - 0.5) × 2
front = absorptionProgress × 1.16 - 0.08
weight = 1 - smoothstep(front - 0.105, front + 0.105, arc)
```

- ближайший участок входит первым;
- зона фронта изгибается и стягивается к sink;
- дальний хвост остаётся пространственно большим;
- поглощённая часть теряет самостоятельную alpha;
- CPU shadow-surface использует согласованное поле;
- обратный progress постепенно выдаёт ленту из MINI CHAOS.

Глобальный scale сохраняется только для legacy ERROR/Cube containment, но не изображает Terrain-поглощение.

## 8. Состояния 1–5 → TERRAIN

```text
current state
→ convergeSource
→ sourceHold
→ releasePoints
→ propagate
→ idle
```

### `convergeSource`

Ленты поглощаются пространственным фронтом. ERROR/Disco Ball, Kernel и fault-particles теряют переходное ownership. Остаются две оболочки CHAOS, которые сжимаются до MINI CHAOS `0.5`.

### `sourceHold`

MINI CHAOS — единственный источник. Палитра проходит `magenta/purple → тёмный десатурированный графит → сдержанные тёплые акценты`. Сплошной жёлтой сферы нет.

### `releasePoints` / `propagate`

Один outward ownership-front раскрывает постоянную Terrain-сетку:

```text
delay = transition-space distance + stable low-frequency distortion
localProgress = smoothstep(delay - 0.025, delay + 0.055, topologyProgress)
frontDistance = (topologyProgress - delay) / 0.065
frontBand = exp(-(frontDistance²))
```

`frontBand` управляет материальным появлением точки, временным height impulse, тёплым свечением и передачей обычному `heightField()` позади фронта. Точки не летят из центра; распространяется ownership.

### `idle`

Первый точный idle-кадр обнуляет все переходные слои. Видимы только Terrain points и необходимые свет/тень/post-processing. `getTransitionDebug().invariantViolations` должен быть пустым.

## 9. CUBE → TERRAIN

```text
FULL CUBE
→ существующий collapseCube
→ существующий collapseSeed
→ ONE SEED CUBE
→ sourceHold
→ releasePoints
→ propagate
→ TERRAIN idle
```

До seed Cube-хореография не меняется. Seed получает малую пульсацию, более яркий amber emissive и центральный свет. Затем outward-front создаёт Terrain.

На этом пути CHAOS и Disco Ball всегда имеют нулевой visual presence; точки не выстреливаются из seed. После потребления seed сбрасываются `cubeReverseActive`, `cubeTransition` и `cubePhase`.

Прежняя розовая сфера появлялась потому, что после раннего отключения Cube reverse-control обычный topology ownership снова разрешал Kernel/Chaos/бинарные слои до Terrain idle. Новый путь удерживает Cube-владельца до фактического потребления seed и отдельно запрещает эти слои.

## 10. TERRAIN → состояния 1–5

```text
TERRAIN
→ collapsePoints
→ тёплый MINI CHAOS
→ подготовка нативной палитры
→ releaseTarget
→ destination
```

### `collapsePoints`

Outer-to-center фронт потребляет Terrain. Точки фронта получают coherent amber/height impulse; позади него Terrain теряет ownership; `terrainRemaining ↓`, `chaosFillProgress ↑`. X/Z точек не меняются.

### Тёплый CHAOS и `compactPaletteHandoff`

В центре причинно материализуются две оболочки CHAOS, а не отдельное жёлтое пятно. Пока фронт собирается, оболочки используют graphite/amber-палитру Terrain. За `TRANSITION_TUNING.terrain.paletteHandoffSeconds = 0.9` палитра плавно возвращается к нативной для направлений 1–5. Геометрия всё время остаётся узнаваемым CHAOS.

### `releaseTarget`

MINI CHAOS передаёт материю destination. Ленты выдаются из sink тем же spatial-полем в обратном направлении. Kernel/fault-слои появляются только если их требует конечное состояние. Disco Ball не является промежуточной стадией.

## 11. TERRAIN → CUBE

```text
TERRAIN
→ collapsePoints
→ тёплый CHAOS размером с Seed Cube
→ прямой morphToSeed
→ seed
→ expand
→ CUBE idle
```

Cube получает уже собранный тёплый CHAOS и начинает непосредственно с `morphToSeed`. Промежуточные Kernel и Disco Ball не появляются; палитра и две оболочки уходят в существующий seed-morph.

## 12. Владение слоями

`getVisualOwnership()` задаёт допустимые сущности состояния, `applyVisualOwnership()` — фазовые ограничения.

- `terrainPresence` — доля обычного поля;
- `terrainConvergence` — сбор/выдача topology source;
- `terrainRibbonAbsorption` — per-vertex suction лент;
- `chaosVisualPresence` — доля двух оболочек CHAOS;
- `terrainChaosPaletteProgress` — переход тёплой палитры CHAOS к нативной.

Legacy `containment` ERROR/Cube не используется как глобальный Terrain-scale. В `TERRAIN idle` жёстко скрываются ribbons, ghosts, Kernel, CHAOS, бинарная сфера, ERROR-debris и Cube cells/seed/lights.

## 13. Вращение и часы

Топологические переходы не создают искусственную раскрутку. Часы, orientation и visibility разделены:

- `lockTransitionOrientations()` фиксирует quaternion `root` и Kernel, но не запрещает отдельно разрешённый clock лент;
- при `ABSORB_CORE_TO_COMPACT` сохраняются исходные `orbitSpeed` и `selfRotation` режима 1–5: лента продолжает ту же орбиту вплоть до полного скрытия в CHAOS, а не замедляется до idle-скорости Cube;
- при `RELEASE_COMPACT_TO_CORE` `orbitAngle` и `selfPhase` продолжаются и в скрытых reverse-фазах;
- каждый кадр сохраняется именно живой quaternion этой траектории; при появлении ленты он применяется напрямую, без slerp к quaternion на старте Cube;
- вне этих разрешённых операций ленты фиксируются без скрытого накопления;
- Euler rewind и rotation catch-up отсутствуют;
- `chaosLayerTimes` продолжают идти, когда CHAOS должен быть живым;
- Cube вращается только в финальном `idle`.

Разрешено естественное вращение лент по уже заданной траектории. При `ABSORB_CORE_TO_COMPACT` оно продолжается с захваченной исходной скоростью до полного поглощения. При `RELEASE_COMPACT_TO_CORE` clock и траектория продолжаются ещё на скрытых фазах, поэтому лента появляется уже на причинно продолженной орбите без скачка. Запрещены добавочное переходное вращение, Euler rewind, slerp к старому frozen quaternion и rotation catch-up.

## 14. Конечные точки

- `CALM / WORK`: штатные ленты, Kernel и предусмотренные состоянием живые слои; без Terrain.
- `ERROR / CRITICAL / CRITICAL_2`: штатные directors могут причинно создать финальный Disco Ball; Terrain transition его не создаёт.
- `CUBE`: полная решётка `8 × 8 × 8`, собственный свет, без старой topology и Terrain.
- `TERRAIN`: 43 200 точек, `14 × 6`, macro/medium/micro, шесть горизонтальных pressure-систем, исходный idle `warmSignal`, без переходных владельцев.

## 15. Важные функции

### `src/visual.ts`

- `setSnapshot()` — инициирует topology change;
- `createTerrainMatter()` — постоянная Terrain-сетка;
- `updateTerrainTransition()` — все фазы входа/выхода Terrain;
- `updateCubeMatter()` — принятая Cube-хореография; Cube seed намеренно не выводит `cubeGlyphs`, поэтому перед началом формирования не возникает самостоятельный слой 0/1;
- `applyVisualOwnership()` — фазовая видимость и hard idle rule;
- `deformShadowSurface()` — CPU-поверхность ленты, включая suction;
- `getTransitionDebug()` — фаза, contributors и idle-аудит.

### `src/shaders.ts`

- `vertexShader` / `fragmentShader` — Kernel/ленты и spatial absorption-front;
- containment shaders — две оболочки CHAOS;
- core-chaos/particle shaders — бинарная часть Disco Ball;
- terrain shaders — высота, край, ownership-front, цвет и point size;
- `heightField()` и `pressureEvent()` — защищённая финальная физика Terrain.

### Остальные

- `src/config.ts` — размеры, grid, длительности, `terrainCoreMorphSeconds`, `STATE_TUNING`;
- `src/state.ts` — состояния;
- `src/error-director.ts`, `src/critical-error-director.ts` — штатная ERROR/CRITICAL-хореография.

## 16. Защищённые инварианты

1. Финальные визуалы состояний 1–6 не переделываются.
2. `pressureEvent()`, macro, medium, micro и idle `warmSignal` не меняются.
3. Terrain имеет шесть pressure-систем, частоту `1.25` и сетку `240 × 180`.
4. Persistent Terrain points сохраняют X/Z; меняется ownership, не траектория.
5. Для каждой фазы есть один причинный владелец материи.
6. MINI CHAOS — две оболочки при масштабе `0.5`; Disco Ball в него не входит.
7. Seed Cube → Terrain не создаёт CHAOS/Disco Ball.
8. В `TERRAIN idle` единственный matter-owner — Terrain.
9. Pressure-системы не сталкиваются и не обмениваются энергией.
10. В переходах запрещены добавочная раскрутка, Euler rewind и rotation catch-up; естественная траектория видимых лент сохраняется.
11. Cube collapse/final state и Chaos clocks сохраняются.

## 17. Регрессионная проверка

Проверять на `1×` и покадрово на `0.25×`:

```text
1/2/3/4/5 → 7
7 → 1/2/3/4/5
6 → 7
7 → 6
2 → 7 → 2
3 → 7 → 3
6 → 7 → 6
```

Критерии:

- ленты входят секциями, дальний хвост не уменьшается преждевременно;
- reverse постепенно выдаёт длину ленты из MINI CHAOS;
- source — только MINI CHAOS или Seed Cube;
- нет розовой бинарной сферы и лишнего Disco Ball;
- Terrain появляется/исчезает за coherent amber-front без point trajectories;
- inward-front непосредственно материализует две тёплые оболочки CHAOS;
- для 1–5 размер равен MINI CHAOS, для CUBE — одному Seed Cube;
- 640 бинарных точек Disco Ball имеют нулевой вклад в Cube/Terrain handoff;
- первый `TERRAIN idle` не содержит старой topology;
- pressure-волны читаются вдоль ±X;
- финальные состояния остаются прежними;
- `npm.cmd run build` проходит без ошибок.

## 18. Архитектурные владельцы после стабилизации

- `src/transition-controller.ts` — запрошенное/установленное состояние, один активный primitive, retarget и типизированный handoff;
- `src/transition-primitives.ts` — нормализованные кривые и именованные lifecycle-пороги;
- `src/visual-ownership.ts` — единственный lifecycle/visibility/clock-policy snapshot всех сущностей;
- `src/transition-debug.ts` — скрытый inspector и development invariants;
- `STATE_TUNING` содержит только параметры финальных состояний;
- `TRANSITION_TUNING` содержит длительности переходов;
- `applyVisualOwnership()` — единственное место runtime-записи `.visible`;
- Terrain публикует handoff и не записывает Cube phase/progress, stable state или directors напрямую.
