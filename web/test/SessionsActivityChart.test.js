import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import SessionsActivityChart from "../src/components/SessionsActivityChart.svelte";

describe("SessionsActivityChart", () => {
  it("renders empty state when no data", () => {
    render(SessionsActivityChart, { props: { turnData: [], agentData: [], labels: [] } });
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });

  it("renders area chart with data", () => {
    render(SessionsActivityChart, {
      props: {
        turnData: [10, 20, 30, 25, 15],
        agentData: [2, 5, 8, 3, 1],
        labels: ["10:00", "11:00", "12:00", "13:00", "14:00"],
      },
    });
    const svg = document.querySelector("svg");
    expect(svg).toBeTruthy();
    const polygons = svg.querySelectorAll("polygon");
    expect(polygons.length).toBe(2);
  });
});
