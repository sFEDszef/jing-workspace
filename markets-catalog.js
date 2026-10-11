/* Shared, allowlisted sector proxies. These are observations, not holdings. */
globalThis.JING_MARKET_CATALOG = Object.freeze([
  {id:'technology',name:'美股科技',symbol:'XLK',scope:'美国科技股 ETF',keywords:['technology','tech','artificial intelligence','ai ','科技'],watch:'关注利率预期、企业盈利与 AI 投资支出。'},
  {id:'semiconductors',name:'半导体',symbol:'SMH',scope:'美国上市半导体 ETF',keywords:['semiconductor','chip','nvidia','半导体'],watch:'关注芯片需求、出口限制与资本开支。'},
  {id:'energy',name:'石油与能源',symbol:'XLE',scope:'美国能源股 ETF；不是原油现货',keywords:['oil','energy','opec','petroleum','gas','能源'],watch:'关注供需、库存、OPEC 决策及运输中断。'},
  {id:'gold',name:'黄金价格',symbol:'GLD',scope:'美国上市实物黄金 ETF；用于观察国际金价，不是招行成交价',keywords:['gold','bullion','黄金'],watch:'关注实际利率、美元、人民币汇率与避险需求。'},
  {id:'goldMiners',name:'黄金矿业股',symbol:'GDX',scope:'全球大型黄金矿业公司 ETF；波动通常大于金价',keywords:['gold miner','gold mining','mining company','gdx','黄金矿业','金矿'],watch:'除金价外，还要关注开采成本、产量、汇率与公司经营。'},
  {id:'banks',name:'美国金融',symbol:'XLF',scope:'美国金融股 ETF',keywords:['bank','financial','credit','银行'],watch:'关注息差、信贷质量与金融监管。'},
  {id:'chinaInternet',name:'中国互联网',symbol:'KWEB',scope:'美国上市中国互联网 ETF；不等同恒生科技指数',keywords:['china','chinese','alibaba','tencent','中国'],watch:'关注国内需求、平台盈利与监管变化。'},
  {id:'chinaShares',name:'中国大盘股',symbol:'FXI',scope:'美国上市中国大盘 ETF；不是 A 股全市场',keywords:['china','hong kong','chinese','中国'],watch:'关注政策、地产、消费与汇率。'},
  {id:'healthcare',name:'美国医疗',symbol:'XLV',scope:'美国医疗股 ETF',keywords:['health','drug','pharma','医疗'],watch:'关注临床进展、医保政策与盈利。'}
]);
