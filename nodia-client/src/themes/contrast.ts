/** WCAG relative luminance for opaque, normalized sRGB colors. */
const luminance = (color: string): number => {
  if (!/^#[\da-f]{6}$/i.test(color)) {
    throw new Error(`Theme color must be an opaque sRGB hex value: ${color}`);
  }
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

export const contrastRatio = (foreground: string, background: string): number => {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

export const mixColor = (from: string, to: string, amount: number): string =>
  `#${[1, 3, 5]
    .map((offset) => {
      const first = parseInt(from.slice(offset, offset + 2), 16);
      const second = parseInt(to.slice(offset, offset + 2), 16);
      return Math.round(first + (second - first) * amount)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;

/** Preserve a source color when readable, otherwise move minimally toward an endpoint. */
export const readableColor = (
  color: string,
  backgrounds: readonly string[],
  minimum = 4.6,
  surfaceTint = 0,
): string => {
  const minimumContrast = (candidate: string) =>
    Math.min(...backgrounds.map((background) =>
      contrastRatio(candidate, mixColor(background, candidate, surfaceTint)),
    ));
  if (minimumContrast(color) >= minimum) return color;

  const endpoints = ["#000000", "#ffffff"];
  const endpoint = endpoints.reduce((best, candidate) =>
    minimumContrast(candidate) > minimumContrast(best) ? candidate : best,
  );
  if (minimumContrast(endpoint) < minimum) {
    throw new Error("Theme surfaces have incompatible text contrast requirements");
  }

  let low = 0;
  let high = 1;
  for (let step = 0; step < 18; step += 1) {
    const middle = (low + high) / 2;
    if (minimumContrast(mixColor(color, endpoint, middle)) >= minimum) high = middle;
    else low = middle;
  }
  return mixColor(color, endpoint, high);
};

export const readableForeground = (background: string, preferred?: string): string => {
  if (preferred && contrastRatio(preferred, background) >= 4.5) return preferred;
  return contrastRatio("#000000", background) >= contrastRatio("#ffffff", background)
    ? "#000000"
    : "#ffffff";
};
