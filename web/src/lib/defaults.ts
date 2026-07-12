/** Default simulation and dashboard values. */

import type { PricePoint } from '$lib/api';

/** Mirrors trading_backtester/api.py MAX_PRICE_POINTS. */
export const MAX_PRICE_POINTS = 10_000;

export function capPricePoints(prices: PricePoint[]): PricePoint[] {
	return prices.length > MAX_PRICE_POINTS ? prices.slice(-MAX_PRICE_POINTS) : prices;
}

export const DEFAULT_STARTING_CAPITAL = 10_000;
export const DEFAULT_FEE_PERCENT = 0.1;
export const MAX_TRADE_TABLE_ROWS = 50;

export type AssetOption = {
	label: string;
	symbol: string;
	category: 'Crypto' | 'Stocks' | 'ETFs' | 'Indices' | 'Forex' | 'Commodities';
	aliases?: string[];
};

export const ASSET_OPTIONS: AssetOption[] = [
	{ label: 'Bitcoin', symbol: 'BTC-USD', category: 'Crypto' },
	{ label: 'Ethereum', symbol: 'ETH-USD', category: 'Crypto' },
	{ label: 'Solana', symbol: 'SOL-USD', category: 'Crypto' },
	{ label: 'BNB', symbol: 'BNB-USD', category: 'Crypto' },
	{ label: 'XRP', symbol: 'XRP-USD', category: 'Crypto' },
	{ label: 'Cardano', symbol: 'ADA-USD', category: 'Crypto' },
	{ label: 'Dogecoin', symbol: 'DOGE-USD', category: 'Crypto' },
	{ label: 'Avalanche', symbol: 'AVAX-USD', category: 'Crypto' },
	{ label: 'Chainlink', symbol: 'LINK-USD', category: 'Crypto' },
	{ label: 'Polkadot', symbol: 'DOT-USD', category: 'Crypto' },
	{ label: 'Toncoin', symbol: 'TON11419-USD', category: 'Crypto' },
	{ label: 'TRON', symbol: 'TRX-USD', category: 'Crypto' },
	{ label: 'Litecoin', symbol: 'LTC-USD', category: 'Crypto' },
	{ label: 'Bitcoin Cash', symbol: 'BCH-USD', category: 'Crypto' },
	{ label: 'Polygon', symbol: 'MATIC-USD', category: 'Crypto' },
	{ label: 'Uniswap', symbol: 'UNI7083-USD', category: 'Crypto' },
	{ label: 'Internet Computer', symbol: 'ICP-USD', category: 'Crypto' },
	{ label: 'Aptos', symbol: 'APT21794-USD', category: 'Crypto' },
	{ label: 'Arbitrum', symbol: 'ARB11841-USD', category: 'Crypto' },
	{ label: 'Cosmos', symbol: 'ATOM-USD', category: 'Crypto' },
	{ label: 'Stellar', symbol: 'XLM-USD', category: 'Crypto' },
	{ label: 'Monero', symbol: 'XMR-USD', category: 'Crypto' },
	{ label: 'Ethereum Classic', symbol: 'ETC-USD', category: 'Crypto' },
	{ label: 'Filecoin', symbol: 'FIL-USD', category: 'Crypto' },
	{ label: 'Apple', symbol: 'AAPL', category: 'Stocks' },
	{ label: 'Microsoft', symbol: 'MSFT', category: 'Stocks' },
	{ label: 'NVIDIA', symbol: 'NVDA', category: 'Stocks' },
	{ label: 'Amazon', symbol: 'AMZN', category: 'Stocks' },
	{ label: 'Alphabet Class A', symbol: 'GOOGL', category: 'Stocks' },
	{ label: 'Meta Platforms', symbol: 'META', category: 'Stocks' },
	{ label: 'Tesla', symbol: 'TSLA', category: 'Stocks' },
	{ label: 'Broadcom', symbol: 'AVGO', category: 'Stocks' },
	{ label: 'Berkshire Hathaway B', symbol: 'BRK-B', category: 'Stocks' },
	{ label: 'JPMorgan Chase', symbol: 'JPM', category: 'Stocks' },
	{ label: 'Visa', symbol: 'V', category: 'Stocks' },
	{ label: 'Eli Lilly', symbol: 'LLY', category: 'Stocks' },
	{ label: 'Novo Nordisk', symbol: 'NVO', category: 'Stocks' },
	{ label: 'Taiwan Semiconductor', symbol: 'TSM', category: 'Stocks' },
	{ label: 'ASML', symbol: 'ASML', category: 'Stocks' },
	{ label: 'AMD', symbol: 'AMD', category: 'Stocks' },
	{ label: 'Intel', symbol: 'INTC', category: 'Stocks' },
	{ label: 'Qualcomm', symbol: 'QCOM', category: 'Stocks' },
	{ label: 'Netflix', symbol: 'NFLX', category: 'Stocks' },
	{ label: 'Adobe', symbol: 'ADBE', category: 'Stocks' },
	{ label: 'Salesforce', symbol: 'CRM', category: 'Stocks' },
	{ label: 'Oracle', symbol: 'ORCL', category: 'Stocks' },
	{ label: 'Cisco', symbol: 'CSCO', category: 'Stocks' },
	{ label: 'Coca-Cola', symbol: 'KO', category: 'Stocks' },
	{ label: 'PepsiCo', symbol: 'PEP', category: 'Stocks' },
	{ label: 'McDonalds', symbol: 'MCD', category: 'Stocks' },
	{ label: 'Walmart', symbol: 'WMT', category: 'Stocks' },
	{ label: 'Costco', symbol: 'COST', category: 'Stocks' },
	{ label: 'Procter & Gamble', symbol: 'PG', category: 'Stocks' },
	{ label: 'Johnson & Johnson', symbol: 'JNJ', category: 'Stocks' },
	{ label: 'UnitedHealth', symbol: 'UNH', category: 'Stocks' },
	{ label: 'Exxon Mobil', symbol: 'XOM', category: 'Stocks' },
	{ label: 'Chevron', symbol: 'CVX', category: 'Stocks' },
	{ label: 'Bank of America', symbol: 'BAC', category: 'Stocks' },
	{ label: 'Mastercard', symbol: 'MA', category: 'Stocks' },
	{ label: 'PayPal', symbol: 'PYPL', category: 'Stocks' },
	{ label: 'Shopify', symbol: 'SHOP', category: 'Stocks' },
	{ label: 'Palantir', symbol: 'PLTR', category: 'Stocks' },
	{ label: 'Super Micro Computer', symbol: 'SMCI', category: 'Stocks' },
	{ label: 'Arm Holdings', symbol: 'ARM', category: 'Stocks' },
	{ label: 'SAP', symbol: 'SAP.DE', category: 'Stocks' },
	{ label: 'Siemens', symbol: 'SIE.DE', category: 'Stocks' },
	{ label: 'Allianz', symbol: 'ALV.DE', category: 'Stocks' },
	{ label: 'Deutsche Telekom', symbol: 'DTE.DE', category: 'Stocks' },
	{ label: 'Rheinmetall', symbol: 'RHM.DE', category: 'Stocks' },
	{ label: 'Mercedes-Benz', symbol: 'MBG.DE', category: 'Stocks' },
	{ label: 'BMW', symbol: 'BMW.DE', category: 'Stocks' },
	{ label: 'Volkswagen', symbol: 'VOW3.DE', category: 'Stocks' },
	{ label: 'Porsche AG', symbol: 'P911.DE', category: 'Stocks' },
	{ label: 'BASF', symbol: 'BAS.DE', category: 'Stocks' },
	{ label: 'Bayer', symbol: 'BAYN.DE', category: 'Stocks' },
	{ label: 'Munich Re', symbol: 'MUV2.DE', category: 'Stocks' },
	{ label: 'Deutsche Bank', symbol: 'DBK.DE', category: 'Stocks' },
	{ label: 'Commerzbank', symbol: 'CBK.DE', category: 'Stocks' },
	{ label: 'Airbus', symbol: 'AIR.PA', category: 'Stocks' },
	{ label: 'LVMH', symbol: 'MC.PA', category: 'Stocks' },
	{ label: 'Hermes', symbol: 'RMS.PA', category: 'Stocks' },
	{ label: 'L-Oreal', symbol: 'OR.PA', category: 'Stocks' },
	{ label: 'Nestle', symbol: 'NESN.SW', category: 'Stocks' },
	{ label: 'Roche', symbol: 'ROG.SW', category: 'Stocks' },
	{ label: 'Novartis', symbol: 'NOVN.SW', category: 'Stocks' },
	{ label: 'Shell', symbol: 'SHEL.L', category: 'Stocks' },
	{ label: 'AstraZeneca', symbol: 'AZN.L', category: 'Stocks' },
	{ label: 'Toyota', symbol: 'TM', category: 'Stocks' },
	{ label: 'Sony', symbol: 'SONY', category: 'Stocks' },
	{ label: 'Alibaba', symbol: 'BABA', category: 'Stocks' },
	{ label: 'Tencent', symbol: '0700.HK', category: 'Stocks' },
	{ label: 'S&P 500 ETF', symbol: 'SPY', category: 'ETFs' },
	{ label: 'Nasdaq 100 ETF', symbol: 'QQQ', category: 'ETFs' },
	{ label: 'Total US Market ETF', symbol: 'VTI', category: 'ETFs' },
	{ label: 'All-World ETF', symbol: 'VT', category: 'ETFs' },
	{
		label: 'iShares Core MSCI World UCITS',
		symbol: 'EUNL.DE',
		category: 'ETFs',
		aliases: ['MSCI World', 'Core MSCI World', 'IWDA', 'SWDA']
	},
	{
		label: 'iShares Core MSCI World UCITS',
		symbol: 'IWDA.AS',
		category: 'ETFs',
		aliases: ['MSCI World', 'Amsterdam', 'IWDA']
	},
	{
		label: 'iShares Core MSCI World UCITS',
		symbol: 'SWDA.L',
		category: 'ETFs',
		aliases: ['MSCI World', 'London', 'SWDA']
	},
	{
		label: 'Xtrackers MSCI World UCITS',
		symbol: 'XDWD.DE',
		category: 'ETFs',
		aliases: ['MSCI World', 'Xtrackers']
	},
	{
		label: 'SPDR MSCI World UCITS',
		symbol: 'SWRD.L',
		category: 'ETFs',
		aliases: ['MSCI World', 'SPDR']
	},
	{
		label: 'HSBC MSCI World UCITS',
		symbol: 'HMWO.L',
		category: 'ETFs',
		aliases: ['MSCI World', 'HSBC']
	},
	{
		label: 'Vanguard FTSE All-World UCITS',
		symbol: 'VWCE.DE',
		category: 'ETFs',
		aliases: ['All World', 'FTSE All World', 'Vanguard']
	},
	{
		label: 'Vanguard FTSE All-World UCITS',
		symbol: 'VWRL.AS',
		category: 'ETFs',
		aliases: ['All World', 'FTSE All World', 'Vanguard']
	},
	{
		label: 'iShares MSCI ACWI UCITS',
		symbol: 'SSAC.L',
		category: 'ETFs',
		aliases: ['ACWI', 'MSCI All Country World']
	},
	{ label: 'iShares MSCI ACWI ETF', symbol: 'ACWI', category: 'ETFs', aliases: ['MSCI ACWI'] },
	{
		label: 'iShares Core MSCI EM IMI UCITS',
		symbol: 'IS3N.DE',
		category: 'ETFs',
		aliases: ['Emerging Markets', 'MSCI EM', 'EIMI']
	},
	{
		label: 'iShares Core MSCI EM IMI UCITS',
		symbol: 'EIMI.L',
		category: 'ETFs',
		aliases: ['Emerging Markets', 'MSCI EM']
	},
	{
		label: 'iShares Core S&P 500 UCITS',
		symbol: 'SXR8.DE',
		category: 'ETFs',
		aliases: ['S&P 500', 'SP500', 'CSPX']
	},
	{
		label: 'iShares Core S&P 500 UCITS',
		symbol: 'CSPX.L',
		category: 'ETFs',
		aliases: ['S&P 500', 'SP500']
	},
	{
		label: 'Vanguard S&P 500 UCITS',
		symbol: 'VUSA.L',
		category: 'ETFs',
		aliases: ['S&P 500', 'SP500', 'Vanguard']
	},
	{
		label: 'Vanguard S&P 500 UCITS',
		symbol: 'VUAA.L',
		category: 'ETFs',
		aliases: ['S&P 500', 'SP500', 'Accumulating']
	},
	{
		label: 'iShares Nasdaq 100 UCITS',
		symbol: 'SXRV.DE',
		category: 'ETFs',
		aliases: ['NASDAQ 100', 'Nasdaq', 'CNDX']
	},
	{
		label: 'Invesco EQQQ Nasdaq-100 UCITS',
		symbol: 'EQQQ.L',
		category: 'ETFs',
		aliases: ['NASDAQ 100', 'Nasdaq']
	},
	{
		label: 'iShares Automation & Robotics UCITS',
		symbol: '2B76.DE',
		category: 'ETFs',
		aliases: ['Robotics', 'Automation']
	},
	{
		label: 'iShares Digitalisation UCITS',
		symbol: '2B78.DE',
		category: 'ETFs',
		aliases: ['Digitalisation', 'Digitalization']
	},
	{
		label: 'iShares S&P 500 Information Technology Sector UCITS',
		symbol: 'QDVE.DE',
		category: 'ETFs',
		aliases: ['Information Technology', 'Tech ETF']
	},
	{
		label: 'iShares Global Clean Energy UCITS',
		symbol: 'IQQH.DE',
		category: 'ETFs',
		aliases: ['Clean Energy', 'Renewable Energy']
	},
	{
		label: 'iShares Global Water UCITS',
		symbol: 'IH2O.L',
		category: 'ETFs',
		aliases: ['Water']
	},
	{
		label: 'VanEck Semiconductor UCITS',
		symbol: 'SMH.L',
		category: 'ETFs',
		aliases: ['Semiconductor', 'Chips']
	},
	{ label: 'Financial Select Sector SPDR', symbol: 'XLF', category: 'ETFs' },
	{ label: 'Technology Select Sector SPDR', symbol: 'XLK', category: 'ETFs' },
	{ label: 'Health Care Select Sector SPDR', symbol: 'XLV', category: 'ETFs' },
	{ label: 'Energy Select Sector SPDR', symbol: 'XLE', category: 'ETFs' },
	{ label: 'Consumer Discretionary Select Sector SPDR', symbol: 'XLY', category: 'ETFs' },
	{ label: 'Consumer Staples Select Sector SPDR', symbol: 'XLP', category: 'ETFs' },
	{ label: 'Industrials Select Sector SPDR', symbol: 'XLI', category: 'ETFs' },
	{ label: 'Utilities Select Sector SPDR', symbol: 'XLU', category: 'ETFs' },
	{ label: 'Real Estate Select Sector SPDR', symbol: 'XLRE', category: 'ETFs' },
	{ label: 'Developed Markets ETF', symbol: 'VEA', category: 'ETFs' },
	{ label: 'Emerging Markets ETF', symbol: 'VWO', category: 'ETFs' },
	{ label: '20+ Year Treasury ETF', symbol: 'TLT', category: 'ETFs' },
	{ label: 'Gold ETF', symbol: 'GLD', category: 'ETFs' },
	{ label: 'Silver ETF', symbol: 'SLV', category: 'ETFs' },
	{ label: 'Oil ETF', symbol: 'USO', category: 'ETFs' },
	{ label: 'S&P 500', symbol: '^GSPC', category: 'Indices' },
	{ label: 'Nasdaq Composite', symbol: '^IXIC', category: 'Indices' },
	{ label: 'Dow Jones', symbol: '^DJI', category: 'Indices' },
	{ label: 'Russell 2000', symbol: '^RUT', category: 'Indices' },
	{ label: 'VIX Volatility', symbol: '^VIX', category: 'Indices' },
	{ label: 'DAX', symbol: '^GDAXI', category: 'Indices' },
	{ label: 'Euro Stoxx 50', symbol: '^STOXX50E', category: 'Indices' },
	{ label: 'FTSE 100', symbol: '^FTSE', category: 'Indices' },
	{ label: 'Nikkei 225', symbol: '^N225', category: 'Indices' },
	{ label: 'Hang Seng', symbol: '^HSI', category: 'Indices' },
	{ label: 'EUR/USD', symbol: 'EURUSD=X', category: 'Forex' },
	{ label: 'GBP/USD', symbol: 'GBPUSD=X', category: 'Forex' },
	{ label: 'USD/JPY', symbol: 'JPY=X', category: 'Forex' },
	{ label: 'USD/CHF', symbol: 'CHF=X', category: 'Forex' },
	{ label: 'AUD/USD', symbol: 'AUDUSD=X', category: 'Forex' },
	{ label: 'USD/CAD', symbol: 'CAD=X', category: 'Forex' },
	{ label: 'NZD/USD', symbol: 'NZDUSD=X', category: 'Forex' },
	{ label: 'EUR/GBP', symbol: 'EURGBP=X', category: 'Forex' },
	{ label: 'Gold Futures', symbol: 'GC=F', category: 'Commodities' },
	{ label: 'Silver Futures', symbol: 'SI=F', category: 'Commodities' },
	{ label: 'Crude Oil WTI', symbol: 'CL=F', category: 'Commodities' },
	{ label: 'Brent Crude Oil', symbol: 'BZ=F', category: 'Commodities' },
	{ label: 'Natural Gas', symbol: 'NG=F', category: 'Commodities' },
	{ label: 'Copper', symbol: 'HG=F', category: 'Commodities' },
	{ label: 'Corn', symbol: 'ZC=F', category: 'Commodities' },
	{ label: 'Soybeans', symbol: 'ZS=F', category: 'Commodities' }
] as const;

export const TICKER_SUGGESTIONS = ASSET_OPTIONS;
