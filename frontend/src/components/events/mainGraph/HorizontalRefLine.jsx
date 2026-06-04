import { useEffect } from 'react';
import Highcharts from 'highcharts';

export default function HorizontalRefLine({ chartRef, yOffset = 0 }) {
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;
    const xAxis = chart.xAxis[0];

    const draw = () => {
      // Use the actual right edge of the plot area instead of xAxis.max
      const xStartGraph = chart.plotLeft + chart.plotWidth; // Right edge of the plot area
      const yLine  = xAxis.top + xAxis.height + yOffset +0.5;
      const xSolidEnd = xStartGraph + 40; // 40 pixels solid line
      const xOuter = chart.chartWidth - 10; // End of the dotted line

      // Destroy existing lines if they exist
      if (chart.customExtSolidLine) chart.customExtSolidLine.destroy();
      if (chart.customExtDottedLine) chart.customExtDottedLine.destroy();

      // Draw the short solid line
      chart.customExtSolidLine = chart.renderer
        .path(['M', xStartGraph, yLine, 'L', xSolidEnd, yLine])
        .attr({
          'stroke-width'   : 1,
          stroke           : '#000',
          'stroke-dasharray': '1 6',
          'stroke-linecap' : 'round',
          crisp            : 1,
          zIndex           : 4,
        })
        .add();

      // Draw the dotted line
      chart.customExtDottedLine = chart.renderer
        .path(['M', xSolidEnd, yLine, 'L', xOuter, yLine])
        .attr({
          'stroke-width'   : 1,
          stroke           : '#000',
          // 'stroke-dasharray': '7 7', // Dotted pattern
          crisp            : 1,
          zIndex           : 4,
        })
        .add();
    };

    draw();
    const redrawHandler = Highcharts.addEvent(chart, 'redraw', draw);

    return () => {
      Highcharts.removeEvent(chart, 'redraw', redrawHandler);
      if (chart.customExtSolidLine) chart.customExtSolidLine.destroy();
      if (chart.customExtDottedLine) chart.customExtDottedLine.destroy();
    };
  }, [chartRef, yOffset]);

  return null;
}