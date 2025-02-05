import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
import pytz
import pathlib

# ------------Dashboard App Layout-------------#
st.set_page_config(page_title="Stock Dashboard", page_icon="📈", layout="wide")
st.title('Real Time Stock Dashboard')

st.divider()

#---------------Linking CSS file---------------#
def load_css(file_path):
    with open(file_path) as f:
        st.html(f'<style>{f.read()}</style>')
        
#--------------loading CSS file----------------#
css_path = pathlib.Path("./styles.css")
load_css(css_path)

# -------------------Part 1--------------------#

# ---------------Fetch the data----------------#
def fetch_stock_data(ticker, period, interval):
    end_date = datetime.now()
    try:
        if period == '1wk':
            start_date = end_date - timedelta(days=7)
            data = yf.download(ticker, start=start_date, end=end_date, interval=interval)
        else:
            data = yf.download(ticker, period=period, interval=interval)
        
        # Flatten MultiIndex columns if they exist
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)
            
        return data
    except Exception as e:
        st.error(f"Error fetching data: {str(e)}")
        return pd.DataFrame()

# --------Process data to match timezone-------#
def process_data(data):
    if data.empty:
        return data
    
    # Convert index to aware datetime
    if data.index.tzinfo is None:
        data.index = data.index.tz_localize('UTC')
    data.index = data.index.tz_convert('Asia/Kolkata')
    
    # Reset index and rename columns
    data = data.reset_index()
    if 'Date' in data.columns:
        data = data.rename(columns={'Date': 'Datetime'})
    elif 'Datetime' not in data.columns:
        data = data.rename(columns={'index': 'Datetime'})
    
    # Ensure numeric columns
    numeric_cols = ['Open', 'High', 'Low', 'Close', 'Volume']
    for col in numeric_cols:
        if col in data.columns:
            data[col] = pd.to_numeric(data[col], errors='coerce')
    
    return data

# ---Calculate metrics using proper previous close---#
def calculate_metrics(ticker, data):
    if data.empty:
        return 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
    
    try:
        stock = yf.Ticker(ticker)
        prev_close = float(stock.info.get('previousClose', 0))
    except:
        prev_close = float(data['Close'].iloc[0]) if not data.empty else 0.0
    
    last_close = float(data['Close'].iloc[-1]) if not data.empty else 0.0
    change = last_close - prev_close
    pct_change = (change / prev_close) * 100 if prev_close != 0 else 0.0
    high = float(data['High'].max()) if not data.empty else 0.0
    low = float(data['Low'].min()) if not data.empty else 0.0
    volume = int(data['Volume'].sum()) if not data.empty else 0
    return last_close, change, pct_change, high, low, volume

# --Add technical indicators (SMA & EMA)--#
def add_technical_indicator(data):
    # Using pandas' built-in functions with NaN handling
    data['SMA_20'] = data['Close'].rolling(window=20, min_periods=1).mean()
    data['EMA_20'] = data['Close'].ewm(span=20, adjust=False).mean()
    return data.fillna(method='ffill')

# -------------------Part 2--------------------#

# Sidebar for user input parameters
st.sidebar.header('Chart Parameters')
ticker = st.sidebar.text_input('Ticker', 'ADBE').strip().upper()
time_period = st.sidebar.selectbox('Time Period', ['1d', '1wk', '1mo', '1y', 'max'])
chart_type = st.sidebar.selectbox('Chart Type', ['Candlestick', 'Line'])
indicators = st.sidebar.multiselect('Technical Indicators', ['SMA 20', 'EMA 20'])

# Mapping time periods to intervals
interval_mapping = {
    '1d': '1m',
    '1wk': '30m',
    '1mo': '1d',
    '1y': '1wk',
    'max': '1wk'
}

# Updating the dashboard based on user input
if st.sidebar.button('Update', key = "colour"):
    data = fetch_stock_data(ticker, time_period, interval_mapping[time_period])
    if data.empty:
        st.warning(f"No data available for {ticker} with the selected period.")
    else:
        data = process_data(data)
        data = add_technical_indicator(data)
        
        
        last_close, change, pct_change, high, low, volume = calculate_metrics(ticker, data)

        # Display main metrics
        st.metric(label=f"{ticker} Last Price", value=f"{last_close:.2f} USD", delta=f"{change:.2f} ({pct_change:.2f}%)")

        # Plot the stock price chart
        fig = go.Figure()
        if chart_type == 'Candlestick':
            fig.add_trace(go.Candlestick(
                x=data['Datetime'],
                open=data['Open'],
                high=data['High'],
                low=data['Low'],
                close=data['Close'],
                name='Price'
            ))
        else:
            fig.add_trace(go.Scatter(
                x=data['Datetime'],
                y=data['Close'],
                mode='lines',
                name='Close Price'
            ))

        # Add selected technical indicators
        for indicator in indicators:
            if indicator == 'SMA 20' and 'SMA_20' in data.columns:
                fig.add_trace(go.Scatter(
                    x=data['Datetime'],
                    y=data['SMA_20'],
                    name='SMA 20',
                    line=dict(color='orange', width=2)
                ))
            elif indicator == 'EMA 20' and 'EMA_20' in data.columns:
                fig.add_trace(go.Scatter(
                    x=data['Datetime'],
                    y=data['EMA_20'],
                    name='EMA 20',
                    line=dict(color='green', width=2)
                ))

        # Format graph
        fig.update_layout(
            title=f'{ticker} {time_period.upper()} Chart',
            xaxis_title='Date & Time (IST)',
            yaxis_title='Price (USD)',
            height=600,
            showlegend=True,
            xaxis_rangeslider_visible=False
        )
        st.plotly_chart(fig, use_container_width=True)
        
        col1, col2, col3 = st.columns(3)
        col1.metric("High", f"{high:.2f} USD")
        col2.metric("Low", f"{low:.2f} USD")
        col3.metric("Volume", f"{volume:,}")
        
        st.divider()
        
        # Debug: Show data structure
        st.write("Processed Data Preview:", data.head())
        
        # Display historical data and technical indicators
        st.subheader('Historical Data')
        st.dataframe(data[['Datetime', 'Open', 'High', 'Low', 'Close', 'Volume']].fillna('N/A'))

        st.subheader('Technical Indicators')
        st.dataframe(data[['Datetime', 'SMA_20', 'EMA_20']].fillna('N/A'))

#----------divider-----------#
st.sidebar.divider()

# Sidebar selection for real-time stock price updates
st.sidebar.header('Top Stock Price')
stock_symbols = ['AAPL', 'GOOGL', 'AMZN', 'MSFT']
for symbol in stock_symbols:
    try:
        real_time_data = fetch_stock_data(symbol, '1d', '1m')
        if not real_time_data.empty:
            real_time_data = process_data(real_time_data)
            if not real_time_data.empty:
                stock = yf.Ticker(symbol)
                last_price = float(real_time_data['Close'].iloc[-1])
                prev_close = float(stock.info.get('previousClose', last_price))
                change = last_price - prev_close
                pct_change = (change / prev_close) * 100 if prev_close != 0 else 0.0
                st.sidebar.metric(
                    label=symbol,
                    value=f"{last_price:.2f} USD",
                    delta=f"{change:.2f} ({pct_change:.2f}%)"
                )
    except Exception as e:
        st.sidebar.error(f"Error fetching data for {symbol}: {str(e)}")

# Sidebar information section
st.sidebar.subheader('About')
st.sidebar.info('This dashboard provides stock data with various indicators.')
