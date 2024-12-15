import React, { useEffect, useState } from 'react';
import './CurrencyMonitor.css';
import axios, { AxiosResponse } from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CurrencyData {
  baseCurrency: string;
  timePeriod: string;
  obsValue: number;
}

interface CurrencyDataExtended {
  timePeriod: string;
  USD: number ;
  GBP: number ;
  SEK: number ;
  CHF: number ;
}


interface ExchangeRateData {
  [currency: string]: CurrencyData[];
}

export const CurrencyMonitorQ: React.FC = () => {
  const [data, setData] = useState<ExchangeRateData>({});
  const [period, setPeriod] = useState<string>('week');

  useEffect(() => {
    fetchCurrencyData();
  }, []);

  const fetchCurrencyData = async () => {
    try {
      const today: Date = new Date();
      const todayISO: string = today.toISOString().split('T')[0];
      const lastYear: Date = new Date(today);
      lastYear.setFullYear(today.getFullYear() - 1);
      const lastYearISO: string = lastYear.toISOString().split('T')[0];
      const currencies: string[] = ['USD', 'GBP', 'SEK', 'CHF'];

      const responses: Promise<AxiosResponse<string>>[] = currencies.map(currencyCode =>
        axios.get(`https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_${currencyCode}_ILS?startperiod=${lastYearISO}&endperiod=${todayISO}`)
      );
      const parsedExchangeRates: ExchangeRateData = await Promise.all<AxiosResponse<string>>(responses).then(responses => {
        const result: ExchangeRateData = {};
        responses.forEach((response, index) => {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(response.data, "application/xml");
          const seriesElements = xmlDoc.getElementsByTagName("Series");
          const parsedData: CurrencyData[] = [];

          for (let i = 0; i < seriesElements.length; i++) {
            const baseCurrency = seriesElements[i].getAttribute("BASE_CURRENCY") ?? "";
            const obsElements = seriesElements[i].getElementsByTagName("Obs");
            for (let j = 0; j < obsElements.length; j++) {
              const timePeriod = obsElements[j].getAttribute("TIME_PERIOD") as string;
              const obsValue = parseFloat(obsElements[j].getAttribute("OBS_VALUE") ?? "");
              parsedData.push({ baseCurrency, timePeriod, obsValue });
            }
          }

          result[currencies[index]] = parsedData;
        });
        return result;
      });

      setData(parsedExchangeRates);

    } catch (error) {
      console.error('Error fetching currency data:', error);
    }
  };

  const getPeriodData = (): CurrencyDataExtended[] | [] => {
    let combinedArray = data['USD']?.map((usdData, index) => ({
      timePeriod: usdData.timePeriod,
      USD: usdData.obsValue ?? null ,
      GBP: data['GBP']?.[index]?.obsValue ?? null,
      SEK: data['SEK']?.[index]?.obsValue ?? null,
      CHF: data['CHF']?.[index]?.obsValue ?? null,
    }))
      ?? [];

    combinedArray = fillMissingDates(combinedArray);
    const day = new Date().getDate();
    switch (period) {
      case 'week':
        return combinedArray.slice(-7);
      case 'month':
        return combinedArray.slice(-day);
      case 'half a year':
        return combinedArray.filter((obj) => new Date(obj?.timePeriod)?.getDate() === day).slice(-6);
      case 'year':
        return combinedArray.filter((obj) => new Date(obj?.timePeriod)?.getDate() === day).slice(-12);
      default:
        return [];
    }
  };

  function fillMissingDates(data) {
    const filledData:CurrencyDataExtended[] = []; 
    let lastDate: CurrencyDataExtended | null = null;

    data.forEach(item => {
      if (lastDate) {
        const date1 = new Date(lastDate.timePeriod).getTime();
        const date2 = new Date(item.timePeriod).getTime();
        const diffInDays = Math.ceil(Math.abs(date2 - date1) / (1000 * 60 * 60 * 24));

        for (let i = 1; i < diffInDays; i++) {
          const missingDate = new Date(date1 + i * 24 * 60 * 60 * 1000);
          filledData.push({
            timePeriod: missingDate.toISOString().slice(0, 10),
            USD: lastDate.USD,
            GBP: lastDate.GBP,
            SEK: lastDate.SEK,
            CHF: lastDate.CHF
          });
        }
      }

      filledData.push(item);
      lastDate = item;
    });

    return filledData;
  }

  const periodData = getPeriodData();

  return (
    <div>
      <div>
        {['week', 'month', 'half a year', 'year'].map((period) => (
          <button key={period} onClick={() => setPeriod(period)}>
            {period}
          </button>
        ))}
      </div>
      <h2>Currency Exchange Rates</h2>
      <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer >
          <LineChart height={300} data={periodData}>
            <CartesianGrid />
            <XAxis ticks={periodData.map((item) => item.timePeriod)} dataKey="timePeriod" />
            <YAxis orientation="right" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="USD" stroke="#8884d8" />
            <Line type="monotone" dataKey="GBP" stroke="#82ca9d" />
            <Line type="monotone" dataKey="SEK" stroke="#ff7300" />
            <Line type="monotone" dataKey="CHF" stroke="#ff0000" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};