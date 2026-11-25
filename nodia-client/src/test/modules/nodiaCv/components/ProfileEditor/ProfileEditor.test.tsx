import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ProfileEditor from "../../../../../modules/nodiaCv/components/ProfileEditor/ProfileEditor";
import { emptyProfile } from "../../../../../modules/nodiaCv/infrastructure/profileSchema";
import i18n from "../../../../../translate";

const values = { ...emptyProfile, profile_name: "Frontend", full_name: "Alex López" };

describe("ProfileEditor field help", () => {
  it("dismisses help with Escape before triggering the profile discard prompt", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(<ProfileEditor title="Perfil de prueba" values={values} onClose={onClose} onSave={onSave} />);

    const field = screen.getByRole("textbox", { name: /^Nombre del perfil/ });
    await user.type(field, " Senior");
    await user.tab({ shift: true });

    const help = screen.getByRole("button", { name: "Ayuda sobre Nombre del perfil" });
    const tooltip = await screen.findByRole("tooltip");
    expect(help).toHaveFocus();
    expect(tooltip).toHaveTextContent("Usa un nombre para distinguir este perfil de otros, como «Frontend Senior».");
    expect(help).toHaveAccessibleDescription(tooltip.textContent ?? "");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(field).toHaveValue("Frontend Senior");
    expect(help).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(await screen.findByRole("tooltip")).toBeVisible();
    await user.tab();
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
    expect(field).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("adds help to repeated fields and distinguishes the two English status inputs", async () => {
    await i18n.changeLanguage("en");
    const user = userEvent.setup();
    const profile = {
      ...values,
      experiences: [{ company: "Example company", position: "Engineer", highlights: [], technologies: [] }],
      projects: [{ name: "Example project", contributions: [], technologies: [] }],
      skill_areas: [{ name: "Web", skills: [] }],
      education: [{ title: "Degree", institution: "Example university" }],
      certifications: [{ name: "Example certification" }],
      languages: [{ language: "Spanish" }],
      additional_sections: [{ title: "Volunteering", lines: [] }],
    };
    render(<ProfileEditor title="Test profile" values={profile} onClose={vi.fn()} onSave={vi.fn()} />);

    const helpButtons = screen.getAllByRole("button", { name: /^Help for / });
    expect(helpButtons).toHaveLength(46);
    const experience = within(screen.getByRole("region", { name: "Work experience" }));
    const project = within(screen.getByRole("region", { name: "Projects" }));

    const experienceHelp = experience.getByRole("button", { name: "Help for Status" });
    await user.hover(experienceHelp);
    const experienceTooltip = await screen.findByRole("tooltip");
    expect(experienceTooltip).toHaveTextContent(i18n.t("nodiaCv:field_help.experiences.status"));
    expect(experienceHelp).toHaveAccessibleDescription(experienceTooltip.textContent ?? "");
    await user.unhover(experienceHelp);
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());

    const projectHelp = project.getByRole("button", { name: "Help for Status" });
    await user.click(projectHelp);
    const projectTooltip = await screen.findByRole("tooltip");
    expect(projectTooltip).toHaveTextContent(i18n.t("nodiaCv:field_help.projects.status"));
    expect(projectHelp).toHaveAccessibleDescription(projectTooltip.textContent ?? "");
    await user.unhover(projectHelp);
    expect(projectHelp).toHaveAttribute("aria-expanded", "true");
    expect(projectTooltip).toBeVisible();
    await user.click(screen.getByRole("textbox", { name: /^Profile name/ }));
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });
});
