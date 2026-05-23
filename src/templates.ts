import { CliError } from "./errors.js";

export interface TemplateInput {
  name: string;
  label: string;
  required: boolean;
  description?: string;
  default?: string;
}

export interface PromptTemplate {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  version: number;
  source: string;
  defaultSize?: string;
  defaultQuality?: string;
  defaultOutputFormat?: string;
  primaryInput: string;
  inputs: TemplateInput[];
  template: string;
}

const SOURCE = "blog:gpt-image-2-prompt-gallery";

export const BUILT_IN_TEMPLATES: PromptTemplate[] = [
  {
    id: "handdrawn-knowledge",
    title: "手绘知识图解",
    summary: "把技术方案、架构说明、复盘结论或知识卡片转成高可读性的手绘信息图。",
    tags: ["tech", "knowledge", "diagram", "report"],
    version: 1,
    source: SOURCE,
    defaultSize: "1536x1024",
    primaryInput: "content",
    inputs: [
      {
        name: "content",
        label: "内容",
        required: true,
        description: "要转成图解的正文、架构说明、复盘结论或知识资料。"
      },
      {
        name: "ratio",
        label: "比例",
        required: false,
        default: "16:9",
        description: "例如 16:9、5:4、4:3 或 21:9。"
      }
    ],
    template: `请把我提供的内容转化成一张高可读性的手绘知识图解。风格像认真整理过的创意手帐 + 白板推演 + 咨询报告信息图，而不是冰冷模板。

【输出目标】
生成一张适合传播、汇报和复用的知识图解。它必须先让人抓住核心判断，再沿着模块逐步阅读，最后记住一句结论。

【语言要求】
图上所有可见文字根据用户的输入来确定语言，中文，英文或其他。
不要混用语言，除非是技术名词、产品名、协议名、代码路径或数字指标。

【画布要求】
比例：{ratio}
质量：4K high resolution
背景：浅米白 / 浅暖灰，保留轻微纸张纹理和呼吸感。
整体清晰、留白稳定，不要把文字挤到看不清。

【信息设计规则】
不要逐字搬运原文。先压缩信息，再画图。
请把内容整理成：
1. 顶部：强标题 + 一句话核心判断
2. 中部：3-6 个主模块，按流程、对比、阶段或因果关系排列
3. 模块内：每个模块最多 3-5 条短 bullet
4. 底部：一条 Flow Summary / Decision Summary / Bottom Line
5. 如果内容很多，只保留最关键的 8-10 个判断，避免微型文字

【可读性规则】
标题必须最大、清楚、有重量。
模块标题要有秩序，正文必须短句化。
每个模块不要超过 6 行正文。
每条 bullet 尽量简短。
不要使用密密麻麻的小字表格。
不要为了完整而牺牲可读性。

【视觉风格】
黑色或深墨色手写线条建立阅读骨架。
使用圆角分区、细线框、轻阴影、编号、箭头、标签和小图标。
线条允许轻微手绘抖动，但整体对齐、边距、分组要稳定。
图标只做路标和强调，不要抢走文字层级。

【配色规则】
使用克制的标记笔色彩：
浅米白背景 + 黑色主线条；
低饱和青绿、鼠尾草绿、淡紫、柔橙、浅蓝作为分区和路径颜色。
避免霓虹色、强渐变、过度商业光效和整页单色化。
彩色区域只占少量到中等面积。

【准确性规则】
严格保持输入内容中的技术链路、组件名称、箭头方向、协议、端口、数据流和判断。
不要自行新增未提供的组件。
不要把动作写错，例如“读取日志”不能画成“生成日志”。
如果空间不足，优先保留主链路、关键差异和最终判断，删掉次要解释。

【内容】
{content}`
  },
  {
    id: "info-visual",
    title: "信息视觉图像",
    summary: "把主题、观点、报告或资料转成明亮克制、带空间层次的信息视觉图像。",
    tags: ["editorial", "report", "cover", "infographic"],
    version: 1,
    source: SOURCE,
    defaultSize: "1536x1024",
    primaryInput: "theme",
    inputs: [
      {
        name: "theme",
        label: "主题",
        required: true,
        description: "主题、核心表达、已有文字或数据。"
      }
    ],
    template: `请根据输入内容，创作一张具有高级编辑设计感的信息视觉图像。它不是普通图表，也不是模板化信息图，而是把信息、数据、观点、文字与情绪转化成一个明亮、克制、带有空间感的微型景象。

在视觉创作之前，先判断信息来源。若输入中已经包含表格、截图、报告、图片、文字资料或明确数据，请优先使用这些材料，提炼其中最适合视觉化的结构。若只提供了主题、年份、行业、问题或方向，而没有足够数据，请先补充可靠资料并交叉核实；凡是涉及当前年份、未来年份、市场变化、平台趋势、价格、政策、榜单、人物、机构、品牌、新闻或任何可能随时间改变的信息，都不能凭空编造。若无法获得可靠资料，请先索要补充信息。画面可以诗意，但数据必须诚实。

请把信息变成一组可以被观看的几何物件：立方体、细长柱体、薄片、切面、平台、容器、边界、悬浮构件、折叠结构、微小标记与空间层级。重要信息可以拥有更清晰的体量、更高的位置、更稳定的结构；次要信息可以更轻、更低、更贴近背景；隐性信息可以藏在边缘、空隙、折面、阴影、标签和细线之中。不要让画面像软件自动生成的图表，而要像一组被安静摆放、缓慢生长出来的信息景观。

构图以大量留白为基础。主体可以居中，也可以轻微偏离中心，让空白成为画面的呼吸。画面需要一个稳定但轻盈的视觉承托，它不应是沉重的大黑块，而应像某种浅色结构、薄层平台、透明边界、漂浮底座或抽象器物。其他信息元素围绕它出现、穿过它、被它轻微遮挡，或从它的上下两侧延展。整体保留轻微透视与体积感，但不要变成真实 3D 渲染；保持平面插画、纸面印刷、低多边形体块和编辑设计之间的暧昧质感。

配色不要通过列举具体颜色来决定，也不要使用固定色卡、流行模板或预设风格。请先根据主题的情绪、信息密度、使用场景和留白比例，生成一套属于这张图自己的色彩关系。色彩的核心不是选某几个颜色，而是建立明度、纯度、温度、重量和距离之间的秩序。整体应明亮、通透、干净，有空气感；背景像有光的纸面一样承托主体，主体色之间依靠明暗层次、冷暖偏移、透明叠加、面积大小和空间远近来区分信息层级。暗色只能作为极少量文字、细线、边缘、刻度、局部阴影或视觉停顿存在，不允许形成大面积压暗。不要让画面变脏、变闷、变厚重，也不要让色彩过度甜腻、商业化、荧光化或模板化。每一张图都应根据输入内容重新生成独立色系。

文字不是说明书，而是画面结构的一部分。标题、短句、数字、百分比、标签、注释应自然嵌入几何体、边缘、空白和视线流动中。重要文字可以独立占据一片留白，像一个问题、一句判断或一句旁白；次要文字可以贴着柱体、折面、侧边、淡阴影或细小构件排列。中文可以竖排、横排、错位、贴边、悬停，但必须保持呼吸感。不要让文字填满画面，也不要让文字变成装饰噪音。它应该在需要被看见的时候出现，在不需要解释的时候退后。

画面中可以出现少量微型人物。人物不需要复杂表情，可以只是站立、观察、搬运、测量、仰望、经过或停留。他们的存在是为了让信息拥有尺度，让宏大的数据变得有人味。人物也可以被简化成剪影、纸片、几何小像或极小的动作痕迹。除此之外，可以根据主题自然生成象征物，但它们必须被几何化、简化、安静化，不要变成素材堆砌。

最终画面应适合用于 PPT 封面、报告插图、信息图、自媒体封面、品牌视觉、名片或知识内容展示。它应该既能承载信息，又像一件可以停留观看的视觉物。要有宏观的空白、微观的细节、克制的秩序、明亮的空气感、轻微的幽默，以及一种没有说满的余味。

用户输入的主题是：{theme}`
  },
  {
    id: "electronics-mini-poster",
    title: "电子元器件微缩图文海报",
    summary: "把一句话、主题或短文案转成具有电子元器件微缩空间感的图文海报。",
    tags: ["tech", "poster", "miniature", "brand"],
    version: 1,
    source: SOURCE,
    defaultSize: "1536x1024",
    primaryInput: "content",
    inputs: [
      {
        name: "content",
        label: "输入内容",
        required: true,
        description: "一句话、主题或短文案。"
      }
    ],
    template: `请将用户输入转译为一张“电子元器件微缩图文海报”。

先判断用户真正想完成的传播任务：是封面、信息图、PPT 首页、品牌主视觉、产品说明、展会海报、社媒配图，还是名片背景。画面必须既好看，也能被阅读。若用户输入了文字，文字就是画面的主角之一，不是小装饰。

文字策略必须严格基于用户输入，不得自行添加与主题无关的口号、虚假数据、空泛行业词或莫名其妙的英文。若用户给了完整文案，只做排版和层级优化，不乱改含义；若用户只给关键词，可补充少量贴合主题的短标签或副标题；若用户没有给文字，则只生成高度概括、克制、准确的主题性文字。所有补充文字都要像从主题里自然长出来，而不是模板套话。

请根据用途决定文字存在感：自媒体封面、海报、PPT 首页的核心关键词必须一眼可见，远看能捕捉；信息图需要清晰分区、标题、短标签、引导线和阅读顺序；品牌图或名片则应更克制、更有识别感。关键文字不能太小，不能藏在角落，不能被场景吞没。主标题、副标题、标签、注释之间要有明确层级。

文字设计要和画面风格融合。它可以出现在建筑立面、展板、微型灯箱、站牌、地面导视、透明信息层、产品标签、边缘留白或 callout 标注中，也可以作为画面主标题形成强排版。字体应随主题变化：科技、工程、温暖、活泼、高级、工业、展会、社媒冲击感都可自然切换。中文要清晰，英文要简洁，字重、间距、对齐、留白要像专业设计。

字体和信息组件可以带一点细小巧思：微型电流线、端子圆点、插孔形状、螺丝纹理、细线节点、标签折角、微光边框、刻度、编号、箭头、极小图标等。它们只能增强节奏和趣味，不能喧宾夺主，也不能变成廉价贴纸。

画面由插座、排插、开关、断路器、线缆、端子、继电器、电源模块、插头、接线结构等真实电子元器件构成微缩空间。它们可以成为建筑、街区、车站、工坊、展台、塔楼、轨道、道路、桥梁或运行中的系统。元件要保持真实材质和可识别结构，不要变形成奇怪物体。

构图必须清楚：一个主视觉核心，一个文字阅读区，一个人物叙事区，一个辅助信息区。可采用中心式、左右分栏、上下分层、斜向动线、留白标题、封面大字或信息图模块构图，但要根据用户意图自然选择。画面要有呼吸感，不能平均摆放，不能堆满。

微型人物应成为叙事线索。他们可以检修、搭建、搬运、展示、协作、通勤、观察、排队或围绕核心装置工作。人物动作要小而准确。植物、轨道、铜线、道路、台阶、工具和标识牌可自然出现，用来引导视线、缓和工业感。

请从用户主题中推导视觉隐喻：增长、连接、安全、能源、效率、协作、品牌、服务、制造、供应链等，都应通过空间关系、人物行为、元件结构和文字层级表达，不要直白解释。

色彩不要套模板。根据主题、行业、情绪和用途智能生成配色。可以干净温暖、冷静科技、明亮社媒、高级克制、工业理性或轻快生活化。颜色必须服务阅读，保证文字与背景有足够对比。避免过度炫彩。

整体呈现微缩模型摄影、产品广告摄影、浅景深、3/4 俯视角、柔和棚拍光、精密塑料与金属质感。最终作品应像一张真实拍摄的电子行业视觉海报，既有宏观秩序，也有局部细节。

避免：真实品牌 Logo、乱码文字、无关文案、虚假数据、空泛口号、关键字过小、文字被遮挡、纯场景无信息层级、拥挤无留白、脏乱电路板、赛博霓虹、废土感、廉价玩具感、不可识别元件、比例过大的小人。

请基于以下输入，自行判断画幅、用途优先级、文字主次、构图方式、配色气质、元件选择、人物行为、信息密度和视觉隐喻：

用户输入内容：
「{content}」`
  },
  {
    id: "monument-valley-poster",
    title: "纪念碑谷气质海报",
    summary: "把主题、单词或短句转成极简超现实主义等距 3D 艺术海报。",
    tags: ["poster", "isometric", "surreal", "poetic"],
    version: 1,
    source: SOURCE,
    defaultSize: "1024x1024",
    primaryInput: "theme",
    inputs: [
      {
        name: "theme",
        label: "主题",
        required: true,
        description: "主题、单词或短句。"
      }
    ],
    template: `请根据用户最后输入的【主题 / 单词 / 短句】，生成一张「纪念碑谷气质」的极简超现实主义 3D 艺术海报。

核心方式：
先理解输入内容的含义、情绪与意象，再将其转译为一组具有建筑感的几何空间，而不是机械地把中文笔画直接做成立体字。若输入为中文，可提炼其核心语义，将关键词、氛围或象征元素巧妙融入主体造型、空间结构与排版中。

画面主体：
以主题语义生成纪念碑谷式的立体几何场景，形成平台、墙体、门洞、通道、桥梁、台阶、迷宫或悬浮结构。整体采用轻俯视等距视角 isometric / axonometric，画面像高级设计海报、建筑概念模型或艺术杂志封面。

色彩与质感：
整体保持高级、明亮、干净、适合印刷输出。主色以奶白、浅灰、砂岩、浅雾粉、淡蓝、薄荷绿、浅杏、柔和暖灰等低饱和浅色为主，减少大面积暗部。仅根据主题语义加入少量点亮色，精准用于局部边缘、深处空间、切面、门洞深处或微小装饰细节。材质为哑光微水泥、石膏、磨砂树脂或高级纸雕质感，光线柔和通透，层次清晰。

构图与层次：
主体仍为视觉中心，但四周需加入少量与主体同语义、同造型逻辑的呼应装饰，形成完整海报感，避免周围过空。装饰必须克制、简洁，并自然形成前景 / 中景 / 后景或主体 / 辅助 / 微装饰的层次关系，让画面更生动但不杂乱。可加入少量重复几何、悬浮小体块、细线结构、局部符号、边角呼应元素或微型景观。

氛围元素：
加入一到两个极简意境元素即可，例如微光、淡月、细枝、小鸟剪影、轻雾、花瓣、远处小体块或象征性图形，使画面更有诗意，但不要堆砌。

人物尺度：
可加入一到两个极小比例人物，作为情绪锚点，人物不超过画面高度 8%，动作安静自然，如站立、行走、眺望、穿行，不喧宾夺主。

排版要求：
可加入极少量设计感文字，如小标题、编号、年份、vol.01、竖排辅助文字或一句简短英文手写句。排版需服务画面，不可过多。

最终要求：
整体简洁、高级、轻盈、富有巧妙层次，兼具纪念碑谷式空间感、语义转译能力、海报设计感与印刷级配色控制。

用户输入主题：
{theme}`
  },
  {
    id: "cold-ink-wallpaper",
    title: "清冷油墨风艺术壁纸",
    summary: "把主题、关键词、短句或参考图片转成清冷、孤独、留白充足的艺术壁纸。",
    tags: ["wallpaper", "art", "painting", "quiet"],
    version: 1,
    source: SOURCE,
    defaultSize: "1536x1024",
    primaryInput: "content",
    inputs: [
      {
        name: "content",
        label: "输入内容",
        required: true,
        description: "主题、关键词、短句或参考图片说明。"
      },
      {
        name: "ratio",
        label: "比例",
        required: false,
        default: "16:9",
        description: "例如 4:3、16:9、9:16 或 1:1。"
      }
    ],
    template: `请根据用户最后输入的【主题】或【参考图片】，生成一张具有强艺术家气质、强审美判断、强风格表达的单幅艺术绘画图像。

你需要先判断输入类型，并执行对应逻辑：

- 如果用户输入的是【主题 / 关键词 / 短句 / 概念】：先理解其气质、情绪、象征、联想与隐藏张力，再从“艺术家的视角”进行视觉转译，而不是直接图解主题。
- 如果用户提供的是【一张或多张参考图片】：不要直接复制原图，而是提炼其中最有价值的主体、姿态、构图重心、物象关系与情绪气息，再以更有艺术判断的方式重新创作。
- 如果用户同时提供【主题 + 图片】：以图片内容为视觉基础，以主题作为情绪和表达方向，让最终画面既保留原图核心识别度，又完成真正有灵气的风格化重构。

这不是普通插画，不是通用唯美风格图，也不是简单滤镜转换。它必须像一位有审美、有手感、有临场判断的顶级艺术家创作出来的作品。画面应有灵气、有呼吸感、有微妙的失衡感和恰到好处的“非标准处理”，而不是机械、均匀、过分工整。

【核心气质】
整体应轻、柔、静、透、旧、雾、松，带有明显的孤独感、安静感与凝视感。像一张被空气、纸纹、时间和柔光轻轻覆盖过的艺术绘画。带有粉彩、油画棒、干湿混合颜料、粗纹画布、磨砂玻璃般的朦胧质感。不要高清，不要锐利，不要塑料感，不要数码感。

【大量留白 / 孤独气质】
画面必须具备高质量留白，不要塞满，不要过度充实，不要把主体撑满画面。留白不是空，而是情绪的一部分，是孤独、距离、呼吸感和高级感的重要来源。
应主动使用大面积安静背景、空旷区域、柔和过渡区域，让主体在留白中被凝视、被衬托、被放大情绪。
整体气质应有轻微的孤独感、疏离感、静默感，像一个被安静观看的瞬间，像情绪停留在空间里，而不是热闹的叙事画面。

【顶级艺术家构图逻辑】
构图必须是一张完整的单幅画面，不要分区，不要四宫格，不要拼贴。构图水平必须体现出顶级艺术家的审美判断，不要普通，不要平铺直叙，不要只是把主体规规矩矩摆在正中间。
要具备真正的高级构图意识，可灵活使用大量留白、非对称平衡、偏置重心、边缘裁切、局部放大、远近反差、视觉停顿、暧昧焦点、局部遮挡、静物化凝固、带有策展意识的画面秩序。

重点不是“完整交代主题”，而是“让画面本身有艺术张力、节奏、余味和记忆点”。

【壁纸适配要求】
最终图像必须达到适合做用户桌面壁纸和手机壁纸的水平。构图要耐看、耐久看，不廉价，不花哨，不堆信息。画面整体要干净、耐看、统一，具有长期观看价值；不要让主体把画面中心全部占满，需保留适当空白区域；预留适合壁纸使用的呼吸区与空域，让画面在桌面图标、手机时间区域存在时依然好看。

【真正的配色逻辑】
以安静、偏冷、偏灰的底色统摄全画面：灰蓝、蓝绿、湖水绿、雾青、浅青灰、冷灰白、淡奶灰等作为基础氛围色，用来建立安静、湿润、柔雾般的空间感。

在局部突然出现少量非常巧妙的彩色亮点。这些亮点色不是平均分布，也不是规则点缀，而像艺术家在某一处凭感觉“突然加进去的一笔妙色”。可灵活出现珊瑚橙、蜜桃粉、番茄红、柠檬黄、奶油黄、明亮草绿、钴蓝、浅紫、亮白、暖橘等。

色彩不是平涂，而要带有“擦、抹、糊、蹭、渗、压、覆盖”的痕迹。颜色之间可以互相侵入、染开、叠压、局部涂抹，形成一种生动的、不那么规矩的绘画性。

【艺术表达手法】
画面必须具有艺术家的处理感，而不是机械生成感。请主动使用局部半完成、半溶解、半擦除、局部涂抹、蹭色、覆盖、拖拽、断裂边缘、轮廓轻微松散、破碎、化开、模糊但很对的笔触和像画家临时改变主意的痕迹。

【主题 / 图片转译逻辑】
无论输入的是主题还是图片，都不要只做表面复现。应自动寻找最值得被凝视的视觉瞬间，把主体进行审美提炼。主体可以是局部、特写、侧面、轮廓、切片、漂浮物、静物、象征物或抽象意象。重要的不是“说明”，而是“表达”。

【笔触与材质】
使用粉彩、油画棒、干刷、厚薄不均的颜料痕迹、柔软的色粉感、略带粗糙的布面纹理。保留颗粒、擦痕、刷痕、叠色、模糊高光、低对比阴影和轻微失焦边缘。边缘不要太利落，颜色可以轻轻渗进去，像停留在粗布和纸面里。

【光线】
柔和漫射光，像清晨窗边、阴天室内、旧画室里的自然光。不要摄影棚光，不要赛博光，不要硬阴影，不要 3D 渲染感。

【最终目标】
最终生成的不是普通“主题插画”或“照片转绘”，而是一张真正具有艺术家视角、配色灵气、手工痕迹、审美判断、孤独气质、大量留白、壁纸级构图与高级记忆点的单幅艺术绘画作品。

【禁止】
不要水印、logo、网址、署名；不要真实摄影感；不要平滑数字插画感；不要机械平均配色；不要所有颜色都很闷；不要普通居中摆拍；不要廉价唯美风；不要过度完整、过度解释；不要明显 AI 塑料感；不要画面拥挤；不要信息太满；不要失去留白与孤独感。

用户输入内容：{content}
比例：{ratio}`
  },
  {
    id: "impressionist-info-poster",
    title: "印象派信息图海报",
    summary: "把一句诗、主题或短句转成兼具艺术插画和信息图排版感的编辑型海报。",
    tags: ["poster", "poem", "editorial", "education"],
    version: 1,
    source: SOURCE,
    defaultSize: "1536x1024",
    primaryInput: "content",
    inputs: [
      {
        name: "content",
        label: "输入内容",
        required: true,
        description: "主题、关键词、短句或诗句。"
      }
    ],
    template: `请根据用户输入的【主题 / 关键词 / 短句 / 诗句】，生成一张兼具艺术气质与信息图排版感的编辑型海报。

整体风格为：平面插画、白色文字背景、印象派与后印象派气质的笔触、近景、线条抽象简约、柔焦效果、空气感、光斑笔刷，整体氛围梦幻、空灵、明亮、鲜艳但不脏乱。插画元素应覆盖画面的大部分区域，形成强烈的整体美感，色彩根据主题灵活变化，但始终保持高级、清透、柔和、有呼吸感；若主题适合柔美花意，可偏粉紫、浅粉、雾紫、嫩绿，但不要把粉紫写死，应让色彩从主题中自然生长。

这不是普通配图海报，也不是满页杂乱文字，更不是左右均分版式。请保留“信息图海报”的排版逻辑：画面主体由满版或大面积插画构成，文字主要集中在左侧，并明确分布为三个层级区域，而不是缩成一坨。

第一，左侧顶部必须形成一个清晰的信息簇，包含小字眉题、年份、英文小标题、中文主标题或副标题等，整体左对齐，字号有大有小，彼此拉开距离，形成上方的视觉起点。
第二，左侧中段或左侧侧边，分布若干组小型信息内容或知识点，可做成短段落、边注、提示语、微型说明、关键词组等，数量约 4-6 组，要求高低错落、疏密变化、长短不一，像信息图海报中的辅助阅读区域，不能整齐堆成同一种文本块。
第三，左侧底部要有收束性的文字区，可放一句中文短句、诗意总结、引导语，以及一小段英文说明或极小字注释，形成版面下方的落点，同样保持左对齐，并与顶部、中段形成明显区分。

所有文字都必须像“被设计过的信息图排版”，具有上下呼应、大小变化、位置分层和节奏感：左上、左中、左下彼此独立又相互联系。不要把所有文字挤在同一块区域，不要平均排布，不要做成单一文本栏，不要缩成一团。

插画不是装饰角料，而应成为主要视觉主体，占据画面大部分空间；文字则作为左侧的信息图式装饰与阅读结构存在。图像负责氛围与审美，文字负责信息层次与阅读趣味，整体像一张高级艺术信息海报：先被画面吸引，再被左侧版式打动，最后愿意停下来阅读。

现在请围绕以下输入生成完整海报：

【用户输入：{content}】

比例：16:9`
  },
  {
    id: "mermaid-infographic",
    title: "Mermaid 信息图重构",
    summary: "把 Mermaid / C4 / Flowchart / Sequence / State / ER / Timeline 重构成专业技术编辑信息图。",
    tags: ["tech", "diagram", "mermaid", "infographic"],
    version: 1,
    source: SOURCE,
    defaultSize: "1536x1024",
    primaryInput: "content",
    inputs: [
      {
        name: "content",
        label: "图表源码",
        required: true,
        description: "Mermaid、C4、Flowchart、Sequence、State、ER、Timeline 源码或渲染图说明。"
      }
    ],
    template: `你是高级信息图重构生成器，兼具信息架构师、视觉设计总监、技术机制图设计师能力。

任务：
将用户提供的 Mermaid / C4 / Flowchart / Sequence / State / ER / Timeline 源码，或其渲染图片，重新设计为一张高保真、高审美、专业级信息图。

目标不是美化原图，不是复刻 Mermaid，不是普通流程图换皮。
你必须先理解其语义结构，再重新编译为新的信息架构图。

Output:
生成一张最终高保真信息图。
不要输出分析过程、解释、Markdown、源码或设计说明。

Input truth rules:
1. 如果输入是源码，源码是语义真相。忽略 Mermaid 原始布局、颜色、classDef、节点样式。
2. 如果输入是图片，图片只作为语义提取材料。不得临摹原图布局、配色、节点形状或箭头路径。
3. 图片文字模糊时，只保留可确认信息，不要编造业务逻辑。

Semantic extraction:
提取 entities、groups、actors、relationships、branches、merges、loops、gates、tools、stores、schemas、states、outputs、triggers、annotations、dependencies、observations。

Role assignment:
为每个实体分配角色：input、output、controller、orchestrator、processor、resolver、decision、gate、tool、storage、observer、actor、artifact、annotation、boundary、event、state、terminal、reference。

Primary mechanism:
必须识别唯一主机制，并让它在 3 秒内可见。主机制类型可为 pipeline、orchestration、resolver pipeline、gating、handoff、layered system、lifecycle、hub-and-spoke、dependency network、sequence interaction、state transition、artifact-centered flow、split decision tree、release / deployment flow。

Primary path:
优先提取 input → controller / processor / decision / resolver → output。
主路径必须成为主视觉轴。
辅助关系只能作为分支、回路、引用线、观察线、traceability 线、dependency 线。

Template selection:
- Linear primary path with <= 7 major steps → Core Flow Spine
- Central controller with >= 3 outgoing branches → Orchestrator Hub
- Runtime / gateway / engine / tools / storage → Layered Blueprint
- Validation / conditional branching → Split Gate
- Multi-actor interaction → Swim Relay
- User action + internal state toggle → Interaction State Panel
- Artifact / version / tag resolves execution → Artifact Anchor Resolver
- Entity relationship → Relational Data Grid
- Dense dependency graph → Clustered Zones
- Lifecycle / state transition → Lifecycle Ring

Style selection:
- SDK / Agent / orchestration / migration / platform / architecture → Premium Technical Editorial
- Business process / product flow / user decision → Premium Light
- Documentation / explanatory mapping → Neutral Editorial
- Layered infra / system runtime → Technical Blueprint
- AI / security / real-time observability only → Dark Futuristic
Default style: Premium Technical Editorial

Canvas defaults:
- aspect ratio: 16:10
- canvas target: 1600 x 1000
- outer padding: 72
- section gap: 56
- node gap: 28-40
- max visible nodes: 18
- max primary path nodes: 7
- max annotation groups: 3

Information compression:
- 同类节点超过 4 个时合并为模块组
- 主路径展开，辅助能力折叠
- 每个节点只保留：名称 + 角色 + 关键约束 / 输出
- 长文本压缩为短标签
- 技术词使用 code token，例如 tool_call、final_output、SQLite、pom.xml
- 不生成密集小字表格

Design tokens:
- background: #F7F5F0
- surface: #FFFFFF
- surface_tint_blue: #EEF4FB
- surface_tint_teal: #EEF7F5
- surface_tint_amber: #FCF6EA
- primary: #1C2E4A
- secondary: #2C7A7B
- accent: #B7791F
- text_primary: #1F2937
- text_secondary: #667085
- border: #D8DEE8
- line_main: 2px
- line_aux: 1px
- radius_card: 10px
- radius_pill: 999px

Visual hierarchy:
controller / orchestrator / core object 权重最高；main path 最连续、最醒目；output / terminal 必须有明确收束感；decision / gate 必须像关键判断点；storage 稳定低调；observer / tracing 使用低对比虚线；tools 像可调用能力，不与主流程平级；annotation 收纳为侧栏、底栏或微型说明。

Node form rules:
event = compact pill；process = calm rectangle；resolver = compact structured block；decision / gate = logic block or split gate；artifact = distinct anchor object；output = terminal capsule；storage = grounded subtle container；reference = quiet chip；observer = low-contrast strip。
不要所有节点同尺寸，不要所有节点都画成白色矩形卡片。

Connection rules:
Sequential flow 使用最强线；branch / merge 使用次级线；loop 使用 curved return line；handoff highlighted but restrained；lookup / reference 使用细线；observation 使用低对比虚线；dependency 使用 desaturated structural line；bidirectional exchange 使用 two-way connector；traceability 使用 fine dashed line。
主流程线最清楚，辅助线降噪。箭头头部小而精确。禁止所有线同色同粗同风格。

Typography:
modern clean technical editorial sans-serif feeling。标题克制，不要海报化；副标题比标题更安静；section heading 清楚；node title 可读且优先；supporting text 次级；edge labels minimal but readable；中英混排要对齐专业；code token should look monospace-like；避免过多粗体。

Background and finish:
warm off-white or soft technical canvas；very subtle paper grain or micro-grid allowed；no heavy shadow；no glow；no glassmorphism；no 3D；no loud gradients；no colorful poster feeling。

Overload handling:
if total entities > 30, group aggressively into <= 6 visible clusters。if the image source is blurry or partial, only keep confirmed information。if semantics are incomplete, omit uncertain nodes rather than inventing them。

Good visual pattern:
one clear visual anchor；main mechanism dominates the center of the layout；auxiliary information is quieter and placed outside the main reading corridor；icons are small and restrained；spacing is generous；section boundaries rely on light surfaces and whitespace；the image feels like a premium technical editorial infographic。

Hard bans:
不要漂亮版 Mermaid；不要普通流程图换皮；不要原样保留 subgraph 大框；不要每个节点加圆形图标；不要图标喧宾夺主；不要彩虹配色；不要大面积高饱和色块；不要重阴影；不要发光；不要 3D；不要玻璃拟态；不要为了完整塞满所有文字；不要编造不存在的信息。

Self-check before rendering:
1. 语义是否守恒
2. 是否没有编造信息
3. 主机制是否一眼可见
4. 主路径是否清楚
5. 布局是否明显不同于原 Mermaid / 原图
6. 节点角色是否通过形态与权重区分
7. 图标是否克制
8. 色彩是否低饱和且高级
9. 背景是否精致但不抢眼
10. 文字是否清晰可读
11. 线条是否有层级
12. 画面是否避免了 AI 粗糙感和 PPT 模板感

若任一项不合格，先重构画面，再输出最终信息图。

输入 Mermaid Code 或图片：
{content}`
  },
  {
    id: "city-line-poster",
    title: "极简线条城市海报",
    summary: "把城市、街区、地标或地点转成竖版极简线条城市海报。",
    tags: ["city", "poster", "travel", "line-art"],
    version: 1,
    source: SOURCE,
    defaultSize: "1024x1536",
    primaryInput: "theme",
    inputs: [
      {
        name: "theme",
        label: "地点",
        required: true,
        description: "城市、街区、地标或具体地点。"
      }
    ],
    template: `请根据最后输入的主题创作一幅超高分辨率竖版极简线条城市海报。

如果主题是一座城市，请先理解这座城市的核心气质，从空间景观、街头生活、人文风情、商业氛围、饮食记忆、地方文化、历史层次与日常节奏中提炼视觉线索，并将这些线索自然组织进同一幅完整而统一的城市画面之中，使画面呈现真实而鲜活的城市切面，而不是零散拼贴。

如果主题是具体街道、街区、地标、商圈或代表性地点，请以该地点的真实空间关系为核心，准确呈现街道结构、建筑界面、店铺招牌、交通设施、文字系统、人群状态与现场氛围，并保留其最有辨识度的在地特征。

如果主题包含地址、坐标或参考图片，请优先依据真实信息理解场景，不要凭空杜撰，不要随意替换地点特征，不要画成与实际地点无关的通用城市景观。

整体画面应避免廉价旅游宣传式表达，不做明信片式直白展示，而是捕捉一个真实、精致、富有生活感的城市瞬间。让建筑、街道、标牌、橱窗、街头设施与人物活动自然共生，地标克制地融入环境，不夸张，不喧宾夺主。人物应体现本地真实穿着、年龄层次、生活方式与行动节奏，可出现通勤、步行、交谈、骑行、购物、等候、用餐或休憩等自然状态。

画面采用竖版正面街头视角，使用极简矢量线描、纤细准确的单线、清晰几何透视、克制留白与高密度但有秩序的细节组织，形成安静、现代、灵动且高级的视觉秩序。整体应具有城市品牌视觉与收藏级旅行海报的完成度。

顶部设置醒目的主标题，副标题使用当地语言与国家或地区信息。所有街头文字、招牌与排版必须清晰、自然、真实、专业，避免乱码、错误文字与随意拼写。

关于色彩，请不要从固定选项中机械挑选，也不要让不同城市反复落入相似的配色模板。请先理解主题本身的气候、光线、时间感、建筑材料、历史气息、产业结构、商业温度、饮食印象、自然环境与情绪质地，再由这些因素综合提炼出专属于该主题的主色与底色关系。每个主题的颜色都应是独立生成的，具有明确的在地性与审美依据，而不是套版结果。允许颜色呈现温度、湿度、年代感、都市能量或文化性格上的差异。主色负责建立城市的精神气质，底色负责提供空气感与纸感，两者共同构成统一而鲜明的单色印刷美学。即使只使用一组主色与底色，也应通过线条疏密、明度层次、局部压重、留白比例与细节节奏形成丰富而细腻的视觉变化，避免单调和平铺。

最终成品需呈现超高分辨率、可打印、线条清晰、细节丰富、风格统一、审美高级的城市海报效果。

主题：{theme}`
  },
  {
    id: "letter-window-poster",
    title: "城市拼音主题海报",
    summary: "把城市、地点、人物、品牌或主题词转成以巨型英文或罗马化标题为核心的收藏级主题海报。",
    tags: ["poster", "city", "typography", "brand"],
    version: 1,
    source: SOURCE,
    defaultSize: "1536x1024",
    primaryInput: "theme",
    inputs: [
      {
        name: "theme",
        label: "主题词",
        required: true,
        description: "城市、地点、人物、品牌、节日、文化概念、物件、情绪、建筑、自然元素或任意名词。"
      }
    ],
    template: `生成一张超高分辨率、印刷级别、具有收藏价值的主题海报。用户会在结尾输入一个主题词，它可以是城市、地点、人物、品牌、节日、文化概念、物件、情绪、建筑、自然元素或任意名词。请围绕这个主题词建立完整视觉系统，并将它转化为画面中央的巨型英文主标题；若主题词不是英文，请自然转换为准确、优雅、适合作为海报标题的英文表达或拼音罗马化形式，不要出现乱码、错误拼写或多余解释。

画面以巨型主标题为核心，字母高耸、粗壮、清晰，像一组被打开的主题橱窗。每个字母之中延展出与主题相关的场景、符号、结构、纹理、空间与叙事片段，它们彼此连通，形成连续而完整的视觉故事。不要机械切割画面，不要平均分配内容，让每个字母之中都像一个被精心组织却仍然自然流动的世界。

顶部设置一条横向剪影式装饰带，可根据主题自然生成相应元素：轮廓、图形、线条、符号、交通、建筑、植物、器物、抽象结构、程序化几何或其他相关视觉片段。它不是孤立装饰，而应与主体在色彩、节奏、密度和气质上完全统一，共同构成完整的版式张力。

整体风格兼具高端编辑设计、中世纪现代、瑞士平面设计与扁平几何插画的气质。构图克制，留白讲究，线条准确，边缘利落，画面安静但具有吸引力。色彩逻辑必须建立在“明亮、柔和、低饱和”的基础上，整体气质清透、轻盈、优雅、精致，避免沉闷、厚重、灰暗或脏浊。以奶白、雾粉、浅蓝、薄荷绿、砂岩、浅灰这一类色相为基础组织画面，也可以延展出柔和杏色、鼠尾草绿、粉蜡橙、淡芥末、灰玫瑰、浅雾紫等相近体系，但所有颜色都应保持低饱和、高级、通透、有空气感。

配色不要走单色压暗路线，也不要落入自然主义的蓝天白云默认方案。应采用一种更聪明的综合色彩编排：以浅亮底色为画面基底，以温柔而克制的综合色组建层次，再以少量更明确的强调色作为视觉锚点。强调色可以略微跳出，但仍需保持审美约束，像一枚点醒画面的按钮，而不是喧宾夺主。整体色彩关系应具有电影感与设计感，明亮但不刺眼，柔和但不寡淡，低饱和但不无聊，丰富但不杂乱，轻盈却不发飘，复古却不陈旧。

暗部必须被严格控制，只作为局部结构、轮廓、节奏或视觉支点使用，不能大面积压低画面情绪。阴影应偏轻、偏薄、偏干净，不制造沉重戏剧感。整幅作品应更接近一种经过精密校准的明亮世界：温柔、清醒、聪明、讲究，并具有让人想收藏的视觉愉悦。

所有可见文字必须使用英文或准确罗马化标题，拼写绝对正确，排版专业、稳定、干净，不出现乱码、变形、破碎字母、随机符号或多余文字。整体效果应达到博物馆级、收藏级海报水准，既有主题识别度，也有大师级的色彩判断与形式完成度。若无额外要求，默认画幅比例为 2:1。

主题词：{theme}`
  },
  {
    id: "geometric-window-poetry-poster",
    title: "几何情绪窗口诗词海报",
    summary: "把诗句、节气或文化主题转成真实物象穿越低饱和几何色块的东方留白海报。",
    tags: ["poster", "poem", "culture", "editorial"],
    version: 1,
    source: SOURCE,
    defaultSize: "1536x1024",
    primaryInput: "theme",
    inputs: [
      {
        name: "theme",
        label: "主题",
        required: true,
        description: "诗句、节气、文化主题或短句。"
      },
      {
        name: "coreObject",
        label: "核心物象",
        required: false,
        default: "根据主题自行提炼最有辨识度的核心物象",
        description: "例如荷叶、花苞、水面、月亮、枝条或器物。"
      },
      {
        name: "visualStyle",
        label: "视觉质感",
        required: false,
        default: "真实摄影质感，柔和自然光，低饱和色彩，细腻写实",
        description: "摄影风格、光影和质感要求。"
      },
      {
        name: "usage",
        label: "用途",
        required: false,
        default: "诗词鉴赏、节气海报、文化主题封面、美学杂志式配图",
        description: "使用场景。"
      },
      {
        name: "background",
        label: "背景",
        required: false,
        default: "大面积白色或浅灰留白，加入极淡文化纹样、线性图形、水波线或抽象符号",
        description: "背景和留白要求。"
      },
      {
        name: "ratio",
        label: "比例",
        required: false,
        default: "16:9",
        description: "例如 16:9、4:3 或 1:1。"
      }
    ],
    template: `设计一张具有高级商业审美的极简海报，核心视觉语言是“真实物象穿越几何情绪窗口”。画面中设置一个窄长的低饱和色块，作为视觉锚点和空间容器，色块颜色根据主题选择柔和浅色，如雾蓝、浅青、米白、淡粉、暖灰或浅金。将【核心物象】以真实摄影质感或精细写实方式置入色块之中，但不要完全困在色块内，要让主体局部越界、破框、延伸到留白区域，形成自然生长感和空间穿透感。

背景保持极简，使用大面积白色或浅灰留白，加入几乎透明的文化纹样、线性图形、地形线、水波线、光影轮廓或抽象符号，作为若隐若现的视觉细节。整体排版要像高端地产、奢侈品、美学杂志或节气海报，文字细长、克制、字距舒展，标题可竖排，辅助信息用小字号规整排列。画面需要有东方留白、现代秩序、自然生命力、轻奢品质感。

避免杂乱、避免高饱和、避免厚重阴影、避免廉价模板感。

本次主题：{theme}
主视觉元素：{visualStyle}
核心物象：{coreObject}
其他要求：画面至少 4 个不同层级、不同逻辑和不同呈现方案的知识点；知识点要服务主题，不要堆满。

用途：{usage}
背景：{background}
比例：{ratio}`
  },
  {
    id: "scroll-beauty-poster",
    title: "东方奇幻叙事人像海报",
    summary: "生成以纵向长画卷为中轴、人物从画卷中破卷而出的 9:16 东方幻想人像海报。",
    tags: ["portrait", "poster", "fantasy", "culture", "wallpaper"],
    version: 1,
    source: SOURCE,
    defaultSize: "1024x1792",
    primaryInput: "character",
    inputs: [
      {
        name: "character",
        label: "主题人物",
        required: true,
        description: "例如古风美人、花神、月下仙子、冷月神女、红衣剑姬。"
      },
      {
        name: "temperament",
        label: "人物气质",
        required: false,
        default: "清冷疏离，唯美，心动，有故事感",
        description: "人物气质和情绪。"
      },
      {
        name: "action",
        label: "动作",
        required: false,
        default: "向前伸手，身体前倾探出，半步迈出画卷",
        description: "破卷而出的动作设定。"
      },
      {
        name: "costume",
        label: "服装",
        required: false,
        default: "白青轻纱汉服，精致飘逸，层次丰富",
        description: "服装方向。"
      },
      {
        name: "palette",
        label: "主色调",
        required: false,
        default: "白、淡青、浅金、深青灰雾境",
        description: "主色调。"
      },
      {
        name: "elements",
        label: "辅助元素",
        required: false,
        default: "白梅、飞鸟、飘纱、花瓣、水面倒影、柔和雾气、月亮",
        description: "前景和氛围元素。"
      }
    ],
    template: `请生成一张高完成度的手机竖版 9:16 东方奇幻叙事人像海报，系列名称为「画中美人 · 破卷而出」。

【主题设定】
主题人物：{character}
人物气质：{temperament}
表情情绪：眼神有情绪感染力，不能呆板，不能恐怖，不能女鬼化。
动作设定：{action}
服装方向：{costume}
主色调：{palette}
辅助元素：{elements}

【核心视觉骨架】
画面中心必须有一幅非常明显的纵向长画卷 / 挂轴，作为整个画面的核心结构。人物不是站在画卷前，而是必须呈现出明显的“从画卷中探出来 / 走出来 / 飞出来 / 破卷而出”的视觉效果。

必须同时满足以下结构逻辑：
1. 人物的大半个身体已经离开画卷，整体趋势明显朝向镜头前方，有很强的破界感和前冲感。
2. 必须保留一部分身体、裙摆、衣摆、脚步或发丝仍然留在画卷之内，形成清晰的“画里画外融合”。
3. 画中人物部分可略带柔和、朦胧、绘画感；探出画外的脸部、手部、上半身则要更加写实、清晰、细腻。
4. 人物与画卷、花枝、飞鸟、飘纱要形成穿插关系，而不是平面摆拍。

【画卷内容】
画卷必须足够长，也比普通卷轴略宽，整体舒展、大气、完整。画卷之内可呈现与主题匹配的东方画境，如山水云雾、花树花境、月夜楼阁、水墨亭台、抽象东方秘境、鹤影寒江或花神卷境。

【人物表现】
人物必须是高颜值、精致、写实的东方人物形象，具有电影级写实人像质感。整体感觉应唯美、心动、有故事感，像“画中人来到现实”的惊艳瞬间。

【前景与空间层次】
画面必须有明显但不喧宾夺主的前景元素，用于制造真实空间纵深，例如前景花枝 / 花朵、少量仙鹤或飞鸟、飘动轻纱、飘落花瓣、水面倒影、柔和雾气、金色微粒 / 光点。前景元素要像真实存在于物理空间中，而不是只贴在背景上；仙鹤 / 飞鸟只能作为陪衬点缀，不能比人物更抢眼。

【背景要求】
背景不要纯黑，也不要复杂写实大场景。请使用低信息量暗色氛围背景，如深青灰雾境、月夜柔雾花境、水墨云烟背景或暖金暗雾背景。背景需要有层次感、空气感、轻微光晕与雾感，但整体仍应克制，不能喧宾夺主。

【构图与镜头感】
整体构图为 9:16 竖版海报式构图，以中轴长画卷为稳定核心，以人物面部和伸出的手部为视觉焦点。上部保留适当呼吸空间和氛围元素，中部强化人物表情与动作，下部通过衣摆、水面、花枝完成落地与收束。阅读路径：先看脸，再看手，再理解破卷而出的叙事关系。

【整体风格要求】
东方幻想美学、古风电影感、写实唯美人像、装置式花境、叙事型海报、梦幻但清晰、精致高完成度。画面清晰，不要过度模糊；探出画外的部分更写实；构图有强烈纵深和镜头感；质感高级，不要低质插画感，不要普通古风写真模板感，不要游戏立绘感。

如果有参考人物图，请以参考图作为人物身份参考，保留其五官辨识度、脸型、妆感方向和整体气质，在此基础上完成「画中美人 · 破卷而出」风格化创作，不要换成陌生脸。

请输出一张细节丰富、氛围唯美、具有明显“从画卷中破卷而出”视觉冲击力的最终成品图。`
  },
  {
    id: "conceptual-logo",
    title: "观念叙事型极简 Logo",
    summary: "为创意、艺术、实验性品牌生成具有隐喻、小场景和大留白的概念型极简 Logo 方向。",
    tags: ["logo", "brand", "minimal", "concept", "identity"],
    version: 1,
    source: SOURCE,
    defaultSize: "1024x1024",
    primaryInput: "brand",
    inputs: [
      {
        name: "brand",
        label: "品牌名",
        required: true,
        description: "品牌名 / 项目名，可包含中英文。"
      },
      {
        name: "type",
        label: "类型",
        required: false,
        default: "创意出版 / 文化项目 / 小众软件品牌 / 独立工作室",
        description: "品牌类型或行业。"
      },
      {
        name: "positioning",
        label: "品牌定位",
        required: false,
        default: "小众、克制、具有设计师气质的独立品牌",
        description: "品牌定位。"
      },
      {
        name: "concept",
        label: "核心概念",
        required: false,
        default: "探索、结构、叙事、精神性、自由",
        description: "核心概念。"
      },
      {
        name: "metaphor",
        label: "隐喻意象",
        required: false,
        default: "几何结构、门、眼睛、月亮、装置、人物与空间关系",
        description: "图形隐喻。"
      },
      {
        name: "mood",
        label: "情绪气质",
        required: false,
        default: "克制、冷静、先锋、神秘、实验、疏离、艺术感、诗性",
        description: "品牌情绪。"
      }
    ],
    template: `请根据用户输入的信息设计一个高完成度的「观念叙事型极简 Logo」。

【用户输入】
品牌名 / 项目名：{brand}
类型 / 行业：{type}
品牌定位：{positioning}
核心概念：{concept}
隐喻意象：{metaphor}
情绪气质：{mood}
主色调：黑 / 白 / 灰 / 深褐 / 墨黑
辅助色：少量红色 / 暗红 / 极少量强调色
画幅比例：1:1

【核心目标】
要设计的不是普通企业 Logo，也不是单纯图形标，而是一个具有“观念表达、叙事张力和极简气质”的品牌标志。它需要通过极少的元素，传达一个概念、一种情绪、一段隐喻关系，形成一个像“小型视觉作品”一样的 Logo。

最终效果应当具备：
1. 极简但不空洞；
2. 留白很多但不单薄；
3. 图形很少但有意味；
4. 文字克制但有设计感；
5. 整体像独立设计师品牌、创意工作室或艺术项目的识别符号。

【设计本质】
这类 Logo 的核心不是直接“说明品牌做什么”，而是通过图形隐喻、场景关系和视觉诗意，去间接表达品牌的精神气质。请优先考虑图形是否有观念、图形与文字之间是否形成叙事关系、留白是否增强作品感、整体是否像一件小型艺术化识别装置。

【最重要的原则】
图形必须简洁，但不能普通；图形必须带有隐喻、象征或观念性；不要把画面塞满，必须保持大量留白；Logo 主体可以偏小，像被放置在安静空间中的一个小型符号；文字必须克制、简洁、有排版意识；不要做成传统厚重商业徽章、热闹卡通 Logo 或普通几何极简标。

【图形设计要求】
请围绕核心概念和隐喻意象，设计一个“具有叙事意味的小型主图形 / 小场景 / 小装置”。图形不能只是普通插画、常规图标或素材拼贴，需要有隐喻感、轻微叙事性和被观看的价值。可以有黑白剪影、细线结构、几何框架、少量红线、局部留白等形式；整体应简洁，不宜太复杂。

【文字设计要求】
文字部分应极其克制，但不能敷衍。品牌名 / 项目名必须清晰可读；英文可偏简洁、细线、全大写、现代感；中文可偏理性、冷静、少量使用；文字可作为图形的注释、对位、分列、标题或支撑结构。允许中英混排，但整体必须克制，不要使用过于花哨的字体，不要让文字成为主视觉堆积。

【排版与构图要求】
整体构图应偏“展览感 / 提案感 / 作品集感”：大量留白，主体较小，可以偏居中，也可以偏左 / 偏右，但要有设计平衡；图与字的关系可分列、对置、上下悬置或横向对位；可加入极细线、极少量小标记、小编号、小副标题；画面不能像海报，也不能像包装正稿，而应像一个独立展示的品牌识别方案。

【色彩要求】
色彩要克制。黑白灰为主体；辅助以少量红色、暗红色、深褐色或一点点冷灰蓝；红色可以作为切线、轨迹、连接线、警示点、局部结构线、强调关系。不要使用高饱和多彩配色，不要大面积渐变，不要热闹。

【适用气质】
整体应呈现先锋、冷静、神秘、诗性、概念性、设计师感、小众品牌感、独立工作室感。

【风格关键词】
观念叙事型极简 Logo、Conceptual Narrative Minimal Logo、experimental logo、symbolic minimal logo、narrative mark、art-directed logo、independent studio branding、editorial-style brand mark、concept-driven brand identity、poetic visual metaphor。

【验收标准】
图形很少但有意味；画面很空但不单薄；有一个清晰的观念或隐喻；品牌名字体克制但有设计感；整体像一件小型品牌视觉作品；带有独立、先锋、设计师气质；与传统商业 Logo 有明显区别；适合创意、艺术、实验性品牌场景使用。

请最终输出一个高完成度的「观念叙事型极简 Logo」，强调隐喻、叙事、小场景、极简构图、大留白、冷静文字与小众先锋气质。`
  },
  {
    id: "botanical-knowledge-card",
    title: "东方留白感花卉知识图鉴",
    summary: "把花卉、植物、知识点或轻量资料转成克制清透、信息自然停靠的东方留白知识卡片。",
    tags: ["botanical", "knowledge", "card", "editorial", "plant"],
    version: 1,
    source: SOURCE,
    defaultSize: "2048x1024",
    primaryInput: "theme",
    inputs: [
      {
        name: "theme",
        label: "主题",
        required: true,
        description: "花卉、植物、知识主题或资料名称。"
      },
      {
        name: "usage",
        label: "用途",
        required: false,
        default: "PPT、信息图、自媒体封面、知识卡片、名片或品牌视觉",
        description: "使用场景。"
      },
      {
        name: "facts",
        label: "文字知识点",
        required: false,
        default: "保留 6 个以内经过校对的知识点，短句化，不要堆满",
        description: "知识点数量和内容要求。"
      },
      {
        name: "composition",
        label: "构图要求",
        required: false,
        default: "非对称留白，主体较大但不压满，信息沿枝干、曲线和留白自然停靠",
        description: "构图、主体大小和画面关系。"
      },
      {
        name: "ratio",
        label: "比例",
        required: false,
        default: "2:1",
        description: "例如 2:1、16:9 或 1:1。"
      }
    ],
    template: `请以一种克制、清透、东方留白感的视觉语言，创作一张适用于 PPT、信息图、自媒体封面、知识卡片、名片或品牌视觉的画面。画面不追求装饰堆叠，而像一件安静生成的作品：信息被轻轻托起，空间有呼吸，视觉元素彼此避让又彼此牵引。

整体配色必须遵循低饱和、浅色、柔雾、近乎纸面的高级感。背景以极浅灰粉、暖白、淡米灰、雾白为主，不使用纯白死板背景；局部出现一块带有空气感的浅薄荷绿、冰蓝绿、淡青色或水雾色块，它不是标准硬边几何，而像被光稀释后的半透明平面。文字颜色使用灰黑、烟灰、深褐灰，不使用高饱和强色。点缀色可以来自自然物：嫩芽绿、枝干褐、花瓣白、浅粉，但必须轻、少、准。

构图采用非对称留白。主体不要居中压满，而是在画面中形成斜向生长、纵向呼吸或轻微偏移的关系。可以有一条自然枝干、柔软线条、植物、纤细曲线、云雾状形体、纸面纹理、淡淡投影或抽象数据轨迹作为视觉主线。它们像自然生长出来，而不是机械摆放。图形要轻盈、柔软、带微弱透明感和虚实层次，避免硬朗科技线框、标准图标模板、商业素材拼贴感。

文字排版是画面的骨架。标题可以纵排、竖向分布、分段留白，字距要疏朗，字号有节制但有仪式感。英文或辅助信息使用极细无衬线、大字距、小字号，像空气中的标注。正文信息不要堆满，适合被拆成短句、诗性短行、数据标签或信息节点。重要数字可以放大，但仍保持安静、优雅，不做电商式冲击。文字与图形之间要有互相成全的关系：文字像落在空间里的秩序，图像像托住信息的气息。

若用户输入的是知识、数据、观点或报告内容，请将其转化为一种轻量信息图：用少量线段、浅色块、微型标签、数字层级、纵向节奏、留白分组来组织信息。不要做传统表格，不要做密集流程图，不要做机械仪表盘。信息应该像被自然地安置在画面中，每一组文字都有自己的停顿和位置。

画面光感柔和，低对比，自然漫射光，带轻微景深与柔焦。可以有极淡阴影、纸张肌理、空气颗粒、半透明叠层。所有元素边缘都要克制，不要锐利过度，不要霓虹，不要赛博，不要高饱和渐变，不要厚重 3D，不要卡通，不要插画感过强。

最终画面应像同一位作者延展出的系列作品：安静、清浅、秩序感强，却不死板；信息明确，却不喧哗；有东方节气般的自然意象，也有现代信息设计的理性骨架。

请根据以下用户变量生成画面：

主题：
{theme}

用途：{usage}

文字知识点：{facts}

构图要求：{composition}

比例：{ratio}`
  }
];

export function listPromptTemplates(): PromptTemplate[] {
  return [...BUILT_IN_TEMPLATES];
}

export function getPromptTemplate(id: string): PromptTemplate {
  const template = BUILT_IN_TEMPLATES.find((item) => item.id === id);
  if (!template) {
    throw new CliError(`Template not found: ${id}`);
  }
  return template;
}

export function renderPromptTemplate(id: string, values: Record<string, string>): string {
  const promptTemplate = getPromptTemplate(id);
  const merged: Record<string, string> = {};
  for (const input of promptTemplate.inputs) {
    if (input.default !== undefined) {
      merged[input.name] = input.default;
    }
  }
  Object.assign(merged, values);

  for (const input of promptTemplate.inputs) {
    if (input.required && !hasValue(merged[input.name])) {
      throw new CliError(`Missing required template variable "${input.name}" for ${id}.`);
    }
  }

  return promptTemplate.template.replace(/\{([a-zA-Z][a-zA-Z0-9_-]*)\}/g, (_match, name: string) => {
    const value = merged[name];
    if (!hasValue(value)) {
      throw new CliError(`Missing template variable "${name}" for ${id}.`);
    }
    return value;
  });
}

function hasValue(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}
