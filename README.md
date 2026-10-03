# AI-IQ Matrix | 高阶智能体与数理逻辑智商测试库

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-purple.svg)](https://vitejs.dev/)
[![KaTeX](https://img.shields.io/badge/LaTeX-KaTeX_2.0-emerald.svg)](https://katex.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-cyan.svg)](https://tailwindcss.com/)

> 📖 **完整详尽的操作指南，请参阅：[使用说明书.md](./使用说明书.md)**

一个现代化、高颜值的 **AI与人类智商基准测试平台（网页版）**。支持题库自由增删改查、LaTeX 数学公式实时所见即所得渲染、AI 视觉识图录入与答案智能排版、一键导入/导出 JSON 题库、全真交互式模拟测验、以及一键连接大语言模型（DeepSeek / OpenAI / Claude / 本地 Ollama）进行全自动答题与思维链（CoT）智商评测。内置 **Claude 羊皮纸典雅质感** 等 4 款视觉主题自由切换。

---

## 🌟 核心特性

1. **📚 题库管理与 CRUD**
   - **增删改查**：支持单选、多选、填空题型；包含题目标题、考查学科、难度等级、选项、标准答案、详细步骤解析和标签。
   - **LaTeX 快捷公式工具栏**：支持一键插入 `\frac{a}{b}`, `\sqrt{x}`, `\lim_{n \to \infty}`, `\sum`, `\int`, `\begin{pmatrix}...`, `\pi`, `\alpha` 等常用符号。
   - **实时左右分栏双向预览**：左侧编辑 Markdown 与 LaTeX，右侧即时呈现美观数学公式。
   - **导入与导出**：一键导出为标准 JSON 题库备份；支持随时导入第三方 JSON 题库或一键重置为官方经典题库。

2. **🧮 深度 LaTeX 公式渲染引擎**
   - 集成 KaTeX 原生排版系统与定制 Markdown 解析器。
   - 支持行内公式 `$E=mc^2$` 与块级居中公式 `$$\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$$`。
   - 健壮的语法容错机制，公式书写错误时优雅提示，永不崩溃。

3. **🎯 交互式模拟测验竞技场（Human IQ Arena）**
   - 自由选择测试题量（5题、10题或全量）与限时模式（15/20/30分钟或不限时）。
   - 现代化沉浸答题卡、题号导航矩阵、疑难题一键标记（Flag）。
   - **常模智商量化评估**：基于均值 100、标准差 15 的正态分布模型测算 Estimated IQ，给出维度能力雷达图与门萨评级。
   - **逐题对拍复盘**：直观对比个人选项与标准答案，呈现完整公式证明。支持一键“错题集专项强化”。

4. **🤖 大模型 AI 智商自动评测套件（AI Benchmark Runner）**
   - **直连主流大模型**：预置 DeepSeek-R1 (Reasoner)、DeepSeek-V3、OpenAI GPT-4o、o3-mini，以及本地 Ollama (`http://localhost:11434/v1`)。
   - **思维链 (CoT) 捕获**：自动提取 DeepSeek-R1 / OpenAI 模型的 Reasoning 思考过程与 `<think>` 标签。
   - **自动化答案提取与对拍判分**：自动计算模型准确率、平均推理延迟与预估 AI 智商。
   - **无 API Key 离线模式**：提供“批量复制 Prompt”，可直接粘贴到网页版 ChatGPT/Claude/DeepSeek 提问。
   - **报告导出**：一键生成并下载高可读性的 Markdown 评测报告。

5. **📊 评测历史与数据持久化**
   - 题库、测试历史、AI 评测战报与 API 配置均安全保存在浏览器本地（LocalStorage），隐私安全无泄露。

---

## 🚀 快速启动

### 运行环境
- Node.js >= 18.0.0
- npm >= 9.0.0

### 本地启动
```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 打开浏览器访问
http://localhost:5173
```

### 构建打包
```bash
npm run build
npm run preview
```

---

## 📖 题库内置题目概览

内置了 10 道涵盖数学极限、线性代数、概率统计、空间拓扑、信息论与数理逻辑的经典高阶题：
1. **级数与积分极限求值**：黎曼和定积分 $\lim_{n \to \infty} \sum_{k=1}^n \frac{n}{n^2 + k^2} = \frac{\pi}{4}$
2. **罕见病诊断的贝叶斯逆概率**：基率谬误与后验概率 $P(D|+)$ 计算
3. **二阶线性递推数列通项**：特征根法求解 $a_n = 5a_{n-1} - 6a_{n-2}$
4. **多面体拓扑与欧拉示性数**：富勒烯足球烯结构中五边形恒为 12 个的拓扑推导
5. **信息论与最优天平称重**：12 球经典称重与香农熵状态极值
6. **多智能体自指归纳博弈**：红眼睛居民与公共知识（Common Knowledge）归纳
7. **高斯双重广义积分**：极坐标雅可比行列式变换求值
8. **布洛斯史上最难逻辑谜题**：反事实条件句与同或双重否定消解
9. **实对称矩阵特征值与迹**：$\text{tr}(A)$ 与 $\det(A)$ 性质
10. **拉姆齐理论与完全图单色子图**：$R(3,3)=6$ 的抽屉原理与图论着色证明
