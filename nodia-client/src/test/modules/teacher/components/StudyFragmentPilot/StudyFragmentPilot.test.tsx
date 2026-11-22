import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { SpellingSequence, VowelComparison } from "../../../../../modules/teacher/components/StudyFragmentPilot";

it("announces a correction and lets the learner pick the other vowel without losing focus", async () => {
  const user = userEvent.setup();
  render(<VowelComparison />);
  const sit = screen.getByRole("button", { name: /^sit / });
  const seat = screen.getByRole("button", { name: /^seat / });
  const feedback = screen.getByRole("status");
  expect(feedback).toBeEmptyDOMElement();

  await user.tab();
  await user.keyboard("{Enter}");
  expect(sit).toHaveFocus();
  expect(feedback).toHaveTextContent("En sit la vocal es /ɪ/");

  await user.tab();
  await user.keyboard(" ");
  expect(seat).toHaveFocus();
  expect(sit).toHaveAttribute("aria-pressed", "false");
  expect(seat).toHaveAttribute("aria-pressed", "true");
  expect(feedback).toHaveTextContent("Seat lleva /iː/");
});

it("reveals each repeated character independently and checks what follows the second E", async () => {
  const user = userEvent.setup();
  render(<SpellingSequence />);
  const list = screen.getByRole("list", { name: /BEE–22/ });
  const [firstB, firstE, secondE, hyphen, firstTwo, secondTwo] = within(list).getAllByRole("button");
  expect(within(list).getAllByRole("listitem")).toHaveLength(6);

  await user.click(secondE);
  expect(firstB).toHaveAttribute("aria-expanded", "false");
  expect(firstE).toHaveAttribute("aria-expanded", "false");
  expect(secondE).toHaveAccessibleDescription("ee");

  await user.click(hyphen);
  expect(hyphen).toHaveAccessibleDescription("hyphen");
  await user.click(secondTwo);
  expect(firstTwo).toHaveAttribute("aria-expanded", "false");
  expect(secondTwo).toHaveAccessibleDescription("two");
  await user.click(secondE);
  expect(secondE).toHaveAttribute("aria-expanded", "false");
  expect(secondTwo).toHaveAttribute("aria-expanded", "true");

  const question = screen.getByRole("group", { name: /después de la segunda E/ });
  await user.click(within(question).getByRole("button", { name: "ee" }));
  expect(screen.getByRole("status")).toHaveTextContent("vuelve a elegir");
  await user.click(within(question).getByRole("button", { name: "hyphen" }));
  expect(screen.getByRole("status")).toHaveTextContent("Después se dice two dos veces");
});
