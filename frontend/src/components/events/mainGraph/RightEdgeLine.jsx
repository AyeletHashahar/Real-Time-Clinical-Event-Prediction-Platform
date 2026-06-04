import { useEffect } from 'react';
import Highcharts from 'highcharts';

export default function RightEdgeLine({ chartRef }) {
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = chartRef.current;

    const drawLine = () => {
      // Use the actual right edge of the plot area instead of xAxis.max
      const xPos = chart.plotLeft + chart.plotWidth;
      
      // Destroy existing line if it exists
      if (chart.customRightEdgeLine) {
        chart.customRightEdgeLine.destroy();
      }

      // Draw the line from the top of the plot area to the bottom
      chart.customRightEdgeLine = chart.renderer
        .path([
          'M', xPos, chart.plotTop,
          'L', xPos, chart.plotTop + chart.plotHeight
        ])
        .attr({
          'stroke-width': 1,
          stroke: '#000',
          'dashstyle': '5 5', // Corresponds to 'Dash' or '7 7'
          'stroke-linejoin' : 'miter',
          zIndex: 4,
          // crisp: 1, // Ensures sharp lines
        })
        .add();
    };

    // Draw initially and on chart redraw events
    drawLine();
    const redrawHandler = Highcharts.addEvent(chart, 'redraw', drawLine);

    return () => {
      Highcharts.removeEvent(chart, 'redraw', redrawHandler);
      if (chart.customRightEdgeLine) {
        chart.customRightEdgeLine.destroy();
        chart.customRightEdgeLine = null;
      }
    };
  }, [chartRef]); // Depend on chartRef

  return null;
}