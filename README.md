# VSC Stock Status Bar

在 VS Code 状态栏显示股票、指数和期货行情的轻量扩展。

## 功能

- 启动 VS Code 后自动刷新并展示状态栏行情。
- 支持 A 股、港股、美股、国内期货、海外期货代码格式。
- 支持手动刷新、添加股票、移除股票、显示/隐藏涨跌图标。
- 支持状态栏 A/港/美 市场按钮筛选，关闭时置灰，开启时高亮。
- 支持多股票分页滚动展示，避免状态栏过长。
- 支持自定义状态栏文本模板和涨跌颜色。
- 支持美股盘前/盘后扩展行情字段。

## 使用

打开命令面板，执行以下命令：

- `VSC Stock: 刷新状态栏行情`
- `VSC Stock: 添加状态栏股票`
- `VSC Stock: 移除状态栏股票`
- `VSC Stock: 显示/隐藏状态栏涨跌图标`
- `VSC Stock: 显示/隐藏 A 股状态栏股票`
- `VSC Stock: 显示/隐藏港股状态栏股票`
- `VSC Stock: 显示/隐藏美股状态栏股票`

也可以在 VS Code 设置里直接修改 `vscstock.*` 配置项。

## 配置

主要配置项：

- `vscstock.aStocks`: A 股市场状态栏股票/指数代码，可省略 `sh`/`sz`/`bj` 前缀。
- `vscstock.hkStocks`: 港股市场状态栏股票/指数代码，可省略 `hk` 前缀。
- `vscstock.usStocks`: 美股市场状态栏股票/指数代码，可省略 `usr_` 前缀。
- `vscstock.stocks`: 其他状态栏股票代码，例如期货或不属于上述市场分组的代码。
- `vscstock.marketVisibility`: 状态栏市场显示开关，默认 A 股、港股、美股都显示。
- `vscstock.interval`: 行情刷新间隔，默认 `5000` 毫秒，最小 `3000` 毫秒。
- `vscstock.maxStatusBarItems`: 状态栏单页最多显示数量，默认 `5`。
- `vscstock.scrollInterval`: 分页滚动展示时间，默认 `5000` 毫秒。
- `vscstock.labelFormat`: 状态栏文本模板。
- `vscstock.riseColor`: 上涨时状态栏文字颜色，默认 `white`。
- `vscstock.fallColor`: 下跌时状态栏文字颜色，默认 `#C9AD06`。
- `vscstock.hideStatusBar`: 是否隐藏股票行情状态栏。
- `vscstock.hideStatusBarIcon`: 是否隐藏状态栏涨跌图标。

默认展示：

- A 股：`000001` 上证指数、`399001` 深证成指、`399006` 创业板指、`000300` 沪深300、`000016` 上证50、`000688` 科创50。
- 港股：`hsi` 恒生指数、`hstech` 恒生科技指数、`hscei` 国企指数、`00700` 腾讯控股、`09988` 阿里巴巴、`00981` 中芯国际。
- 美股：`dji` 道琼斯、`ixic` 纳斯达克、`inx` 标普500指数、`nvda`、`goog`。

代码示例：

- A 股：`000001`、`sh600519`、`sz399001`
- 港股：`00700`、`hk09988`、`hsi`
- 美股：`tsla`、`usr_nvda`、`dji`
- 国内期货：`nf_IF0`
- 海外期货：`hf_OIL`

状态栏左侧会显示 `A`、`港`、`美` 三个按钮，点击可隐藏或恢复对应市场股票。配置在
`vscstock.aStocks`、`vscstock.hkStocks`、`vscstock.usStocks` 的代码会响应对应按钮；
`vscstock.stocks` 里的可识别 A 股、港股、美股代码也会响应对应按钮，例如 `sh600519`、
`hk00700`、`usr_tsla`、`000001`、`00700`、`dji`。期货等无法归入这三个市场的其他代码不受这些按钮影响。

`labelFormat` 可用字段：

```text
code, name, price, percent, updown, open, yestclose, high, low, time, icon,
afterPrice, afterPercent, extendedLabel, extendedTime
```

默认模板：

```text
「${name}」${price} ${icon}（${percent}）
```

## 数据来源与隐私

本扩展会请求第三方公开行情接口获取行情数据：

- A 股、美股、国内期货、海外期货：`https://hq.sinajs.cn`
- 港股：`https://qt.gtimg.cn`

扩展不会采集用户身份信息，不包含遥测上报。配置的股票代码会作为查询参数发送给上述行情接口。行情接口的可用性、延迟、准确性和覆盖范围由第三方服务决定。

## 免责声明

本扩展仅用于在编辑器状态栏展示行情信息，不构成任何投资建议。行情数据可能延迟、缺失或错误，请以交易所、券商或其他官方渠道的数据为准。使用本扩展产生的任何投资决策和风险由用户自行承担。

## 开发

```bash
npm ci
npm test
npm run package
```

重新生成 Marketplace 图标：

```bash
npm run generate:icon
```

## License

BSD-3-Clause
