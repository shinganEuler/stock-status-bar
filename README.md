# VSC Stock Status Bar

这是一个参考 `leek-fund` 状态栏行情逻辑拆出来的精简 VS Code 插件，只保留股票行情在状态栏展示这一项功能。

## 功能

- 启动 VS Code 后自动在状态栏展示配置的股票行情。
- 支持 A 股、港股、美股、国内期货、海外期货代码格式。
- 支持手动刷新、添加/移除状态栏股票、显示/隐藏涨跌图标。

## 配置

主要配置项：

- `vscstock.aStocks`: A 股市场状态栏股票/指数代码，可省略 `sh`/`sz`/`bj` 前缀。
- `vscstock.hkStocks`: 港股市场状态栏股票/指数代码，可省略 `hk` 前缀。
- `vscstock.usStocks`: 美股市场状态栏股票/指数代码，可省略 `usr_` 前缀。
- `vscstock.stocks`: 其他状态栏股票代码，例如期货或不属于上述市场分组的代码。
- `vscstock.interval`: 刷新间隔，默认 `5000` 毫秒，最小 `3000` 毫秒。
- `vscstock.maxStatusBarItems`: 状态栏单页最多显示数量，默认 `5`。
- `vscstock.scrollInterval`: 分页滚动显示时间，默认 `5000` 毫秒。
- `vscstock.labelFormat`: 状态栏文本模板，默认 `「${name}」${price} ${icon}（${percent}）`。美股盘前/盘后可用 `${extendedLabel}`、`${afterPrice}`、`${afterPercent}`、`${extendedTime}`。
- `vscstock.riseColor`: 上涨颜色。
- `vscstock.fallColor`: 下跌颜色。
- `vscstock.hideStatusBar`: 隐藏状态栏行情。
- `vscstock.hideStatusBarIcon`: 隐藏涨跌图标。

默认指数：

- A 股：`000001` 上证指数、`399001` 深证成指、`399006` 创业板指、`000300` 沪深300、`000016` 上证50、`000688` 科创50。
- 港股：`hsi` 恒生指数、`hstech` 恒生科技指数、`hscei` 国企指数。
- 美股：`dji` 道琼斯、`ixic` 纳斯达克、`inx` 标普500指数。

个股/期货示例：港股分组里可写 `00700`，美股分组里可写 `tsla`，其他分组里可写 `nf_IF0`、`hf_OIL`。
