from pathlib import Path
r=Path('nodia-client/src')
p=r/'test/modules/nodiaAi/components/ProposalPreview/HumanProposalReview.test.tsx';s=p.read_text();s='import { coreUserProposal, coreUserReview, coreRoleProposal, coreRoleReview, coreArray } from "../../infrastructure/coreFixtures";\n'+s
needle='describe("human proposal confirmation and registered edits", () => {'
s=s.replace(needle,needle+'''
  it("revises a final role collection using exact IDs and preserves it after a server rejection", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422, "Synthetic invalid association"));
    open(coreUserReview, coreUserProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Agregar ID a Roles finales" }), { target: { value: "9007199254740996" } });
    await userEvent.click(screen.getAllByRole("button", { name: "Agregar ID" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    await screen.findByText("Synthetic invalid association");
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "roles", value: coreArray(["9007199254740993", "9007199254740996"]) }] }));
    expect(screen.getByRole("button", { name: "Roles finales" })).toHaveTextContent("9007199254740996");
    expect(screen.getByRole("textbox", { name: /^Correo/ })).toHaveValue("synthetic@example.invalid");
  });
  it("edits an ES translation without changing its key, English value or other command fields", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422));
    open(coreRoleReview, coreRoleProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    fireEvent.change(screen.getByDisplayValue("Rol sintético"), { target: { value: "Rol revisado" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "translates", value: { kind: "array", items: [{ kind: "object", fields: [{ field_key: "key", value: "name" }, { field_key: "es", value: "Rol revisado" }, { field_key: "en", value: "Synthetic role" }] }] } }] }));
    expect(screen.getByDisplayValue("Rol revisado")).toBeInTheDocument();
  });
  it("keeps incomplete translations editable and blocks the revision request", async () => {
    open(coreRoleReview, coreRoleProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    fireEvent.change(screen.getByDisplayValue("Synthetic role"), { target: { value: "" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(await screen.findByText("Completa clave, español e inglés sin claves repetidas.")).toBeInTheDocument();
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Rol sintético")).toBeInTheDocument();
  });
''')
p.write_text(s)
p=r/'test/modules/nodiaAi/components/ProposalPreview/ProposalPreview.test.tsx';s=p.read_text();s='import { coreUserProposal, coreUserReview, coreDeleteProposal, coreArray } from "../../infrastructure/coreFixtures";\n'+s
needle='describe("NodiaAI immutable proposal previews", () => {'
s=s.replace(needle,needle+'''
  it.each([
    ["users", "create", "Crear usuario"], ["users", "update", "Actualizar usuario"],
    ["roles", "create", "Crear rol"], ["roles", "update", "Actualizar rol"], ["roles", "delete", "Eliminar rol"],
    ["actions", "create", "Crear acción"], ["actions", "update", "Actualizar acción"], ["actions", "delete", "Eliminar acción"],
    ["business_actions", "create", "Crear acción de negocio"], ["business_actions", "update", "Actualizar acción de negocio"], ["business_actions", "delete", "Eliminar acción de negocio"],
    ["modules", "create", "Crear módulo"], ["modules", "update", "Actualizar módulo"], ["modules", "delete", "Eliminar módulo"],
    ["module_groups", "create", "Crear grupo de módulos"], ["module_groups", "update", "Actualizar grupo de módulos"], ["module_groups", "delete", "Eliminar grupo de módulos"],
  ])("labels the registered %s/%s operation", async (resource, operation, label) => {
    mocks.getNodiaAiProposal.mockResolvedValue({ ...coreUserProposal, steps: [{ ...coreUserProposal.steps[0], tool_name: `nodia_${resource}_prepare_${operation}` }] });
    open(); await preview();
    expect(await screen.findByText(`Paso 1: ${label}`)).toBeInTheDocument();
  });
  it("shows access loss and affected users before confirmation without editable authority fields", async () => {
    mocks.getNodiaAiProposal.mockResolvedValue(coreDeleteProposal);
    open(); await preview();
    expect(await screen.findByText(/Esta eliminación puede retirar asociaciones y acceso/)).toBeInTheDocument();
    expect(screen.getByText("Usuarios afectados")).toBeInTheDocument();
    expect(screen.getByText("Módulos retirados")).toBeInTheDocument();
    expect(screen.getByText("9007199254740995")).toBeInTheDocument();
  });
  it.each([coreArray(["01"]), coreArray(["1", "1"]), coreArray([9007199254740992])])("rejects malformed saved Core collections before exposing human controls", async value => {
    mocks.getNodiaAiProposal.mockResolvedValue({ ...coreUserProposal, steps: [{ ...coreUserProposal.steps[0], changes: coreUserProposal.steps[0].changes.map(change => change.field_key === "roles" ? { ...change, after: value } : change) }] });
    mocks.getNodiaAiProposalReview.mockResolvedValue(coreUserReview);
    open(); await preview();
    expect(await screen.findByText(/No pudimos verificar las acciones permitidas/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar revisión/ })).not.toBeInTheDocument();
  });
''');p.write_text(s)
p=r/'test/modules/nodiaAi/components/ConfirmedExecution/ConfirmedExecution.test.tsx';s=p.read_text();needle='describe("confirmed execution observation and human controls", () => {';s=s.replace(needle,needle+'''
  it.each([
    ["users", "Usuario", "/settings/users"], ["roles", "Rol", "/settings/roles"], ["actions", "Acción", "/settings/actions"],
    ["business_actions", "Acción de negocio", "/settings/actions"], ["modules", "Módulo", "/settings/modules"], ["module_groups", "Grupo de módulos", "/settings/modules"],
  ])("shows %s history and refreshes the current actor authority without granting it", async (resource_key, label, route) => {
    const invalidation = vi.spyOn(client, "invalidateQueries");
    mocks.getNodiaAiExecution.mockResolvedValue({ ...completed, steps: [{ ...completed.steps[0], result_refs: [{ resource_key, id: "9007199254740993" }] }] });
    open();
    expect(await screen.findByText(`Operación verificada · ${label}: 9007199254740993`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir administración" })).toHaveAttribute("href", route);
    await waitFor(() => expect(invalidation).toHaveBeenCalledWith({ queryKey: ["authorization", "context", "9"] }));
    expect(invalidation).toHaveBeenCalledWith({ queryKey: nodiaAiKeys.all(["9", 1]) });
    expect(invalidation).not.toHaveBeenCalledWith({ queryKey: ["authorization", "context", "10"] });
    expect(mocks.controlNodiaAiExecution).not.toHaveBeenCalled();
  });
''');p.write_text(s)
p=r/'test/manual/nodia-ai/fixtures.ts';s=p.read_text();s='import { coreUserProposal, coreUserReview, coreRoleProposal, coreRoleReview, coreDeleteProposal } from "../../modules/nodiaAi/infrastructure/coreFixtures";\n'+s
s=s.replace('const ai26Fixture = ({','const ai26Fixture = ({\n    "core-user": { proposal: coreUserProposal, review: coreUserReview, resource: "users" },\n    "core-role": { proposal: coreRoleProposal, review: coreRoleReview, resource: "roles" },\n    "core-delete": { proposal: coreDeleteProposal, review: readonlyReview, resource: "modules" },\n    "core-receipt": { proposal: coreUserProposal, review: readonlyReview, resource: "users" },')
# The shared synthetic fixture path already preserves scope for registered module cases.
p.write_text(s)
