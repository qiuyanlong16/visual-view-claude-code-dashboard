<script>
  export let data = [];
  export let color = "#60a5fa";
  export let width = 80;
  export let height = 30;

  $: points = data.length > 1
    ? data.map((v, i) => {
        const x = (i / (data.length - 1)) * (width - 4) + 2;
        const max = Math.max(...data, 1);
        const y = height - 2 - (v / max) * (height - 4);
        return `${x},${y}`;
      }).join(" ")
    : `2,${height / 2} ${width - 2},${height / 2}`;
</script>

<svg {width} {height}>
  <polyline {points} fill="none" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
