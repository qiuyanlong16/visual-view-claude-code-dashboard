import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
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

  it("renders Y-axis tick labels", () => {
    render(SessionsActivityChart, {
      props: {
        turnData: [10, 20, 30, 25, 15],
        agentData: [2, 5, 8, 3, 1],
        labels: ["10:00", "11:00", "12:00", "13:00", "14:00"],
      },
    });
    const svg = document.querySelector("svg");
    const textElements = svg.querySelectorAll("text");
    const yAxisLabels = Array.from(textElements).filter(
      (t) => t.getAttribute("text-anchor") === "end"
    );
    expect(yAxisLabels.length).toBeGreaterThan(0);
    expect(yAxisLabels[0].textContent).toBe("0");
  });

  it("shows tooltip on mouse move", async () => {
    render(SessionsActivityChart, {
      props: {
        turnData: [10, 20, 30, 25, 15],
        agentData: [2, 5, 8, 3, 1],
        labels: ["10:00", "11:00", "12:00", "13:00", "14:00"],
      },
    });
    const svg = document.querySelector("svg");
    const rect = svg.getBoundingClientRect();
    // Simulate mouse move near the middle of the chart
    await fireEvent.mouseMove(svg, {
      clientX: rect.left + rect.width * 0.5,
      clientY: rect.top + rect.height * 0.5,
    });
    const tooltipGroup = svg.querySelector(".tooltip-group");
    expect(tooltipGroup).toBeTruthy();
    const tooltipTexts = tooltipGroup.querySelectorAll("text");
    const labelText = Array.from(tooltipTexts).find(
      (t) => t.textContent.includes("Turns:")
    );
    expect(labelText).toBeTruthy();
    expect(labelText.textContent).toMatch(/Turns: \d+/);
  });

  it("hides tooltip on mouse leave", async () => {
    render(SessionsActivityChart, {
      props: {
        turnData: [10, 20, 30, 25, 15],
        agentData: [2, 5, 8, 3, 1],
        labels: ["10:00", "11:00", "12:00", "13:00", "14:00"],
      },
    });
    const svg = document.querySelector("svg");
    const rect = svg.getBoundingClientRect();
    await fireEvent.mouseMove(svg, {
      clientX: rect.left + rect.width * 0.5,
      clientY: rect.top + rect.height * 0.5,
    });
    expect(svg.querySelector(".tooltip-group")).toBeTruthy();
    await fireEvent.mouseLeave(svg);
    expect(svg.querySelector(".tooltip-group")).toBeFalsy();
  });
});
