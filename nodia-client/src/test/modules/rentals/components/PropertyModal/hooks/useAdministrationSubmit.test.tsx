import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useAdministrationSubmit } from "../../../../../../modules/rentals/components/PropertyModal/hooks/useAdministrationSubmit";
it("guards a repeated submit before render and calls completion only on success", async () => {
  let resolve!: (value: string | undefined) => void;
  const save = vi.fn(
    () =>
      new Promise<string | undefined>((done) => {
        resolve = done;
      }),
  );
  const done = vi.fn();
  const { result } = renderHook(() => useAdministrationSubmit(save, done));
  let first!: Promise<void>;
  act(() => {
    first = result.current("edited");
    void result.current("second");
  });
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith("edited");
  await act(async () => {
    resolve(undefined);
    await first;
  });
  expect(done).not.toHaveBeenCalled();
  save.mockResolvedValueOnce("ack");
  await act(async () => {
    await result.current("corrected");
  });
  expect(done).toHaveBeenCalledWith("ack");
});
