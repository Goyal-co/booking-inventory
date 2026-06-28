/** @type {import('tailwindcss').Config} */
const baseExtend = {
  fontFamily: {
    sans: ["Inter", "system-ui", "sans-serif"],
    serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
  },
  borderRadius: {
    xl: "12px",
  },
  colors: {
    navy: {
      DEFAULT: "#1E3A5F",
      50: "#F0F4F8",
      100: "#D9E2EC",
      600: "#1E3A5F",
      700: "#152A45",
      800: "#0F1F33",
    },
    success: {
      DEFAULT: "#059669",
      50: "#ECFDF5",
      600: "#059669",
    },
    warning: {
      DEFAULT: "#D97706",
      50: "#FFFBEB",
      600: "#D97706",
    },
    danger: {
      DEFAULT: "#DC2626",
      50: "#FEF2F2",
      600: "#DC2626",
    },
    info: {
      DEFAULT: "#2563EB",
      50: "#EFF6FF",
      600: "#2563EB",
    },
  },
};

/** Gold brand palette for Admin portal */
const adminBrand = {
  brand: {
    DEFAULT: "#C8960C",
    50: "#FDF8ED",
    100: "#F9EDCF",
    200: "#F2D99A",
    300: "#E8C05A",
    400: "#D4A017",
    500: "#C8960C",
    600: "#A67C00",
    700: "#8A6600",
    800: "#6E5100",
    900: "#523C00",
  },
};

/** Orange brand palette for Sales portal */
const salesBrand = {
  brand: {
    DEFAULT: "#E89B0C",
    50: "#FFF8ED",
    100: "#FEEFD0",
    200: "#FDDB9E",
    300: "#FBC56A",
    400: "#F59E0B",
    500: "#E89B0C",
    600: "#D97706",
    700: "#B45309",
    800: "#92400E",
    900: "#78350F",
  },
};

function createPreset(brandColors) {
  return {
    theme: {
      extend: {
        ...baseExtend,
        colors: {
          ...baseExtend.colors,
          ...brandColors,
        },
      },
    },
  };
}

module.exports = {
  baseExtend,
  adminBrand,
  salesBrand,
  adminPreset: createPreset(adminBrand),
  salesPreset: createPreset(salesBrand),
};
