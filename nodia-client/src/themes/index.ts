import nodia from "./nodia";
import tweakcnDefault from "./tweakcn-default";
import modernMinimal from "./modern-minimal";
import violetBloom from "./violet-bloom";
import t3Chat from "./t3-chat";
import twitter from "./twitter";
import mochaMousse from "./mocha-mousse";
import bubblegum from "./bubblegum";
import amethystHaze from "./amethyst-haze";
import notebook from "./notebook";
import doom64 from "./doom-64";
import catppuccin from "./catppuccin";
import graphite from "./graphite";
import perpetuity from "./perpetuity";
import kodamaGrove from "./kodama-grove";
import cosmicNight from "./cosmic-night";
import tangerine from "./tangerine";
import quantumRose from "./quantum-rose";
import nature from "./nature";
import boldTech from "./bold-tech";
import elegantLuxury from "./elegant-luxury";
import amberMinimal from "./amber-minimal";
import supabase from "./supabase";
import neoBrutalism from "./neo-brutalism";
import solarDusk from "./solar-dusk";
import claymorphism from "./claymorphism";
import cyberpunk from "./cyberpunk";
import pastelDreams from "./pastel-dreams";
import cleanSlate from "./clean-slate";
import caffeine from "./caffeine";
import oceanBreeze from "./ocean-breeze";
import retroArcade from "./retro-arcade";
import midnightBloom from "./midnight-bloom";
import candyland from "./candyland";
import northernLights from "./northern-lights";
import vintagePaper from "./vintage-paper";
import sunsetHorizon from "./sunset-horizon";
import starryNight from "./starry-night";
import claude from "./claude";
import vercel from "./vercel";
import darkmatter from "./darkmatter";
import mono from "./mono";
import softPop from "./soft-pop";
import sageGarden from "./sage-garden";
import type { AppThemePreset } from "./types";

export type { AppThemePreset } from "./types";
export const DEFAULT_THEME_ID = "nodia";

export const themePresets: readonly AppThemePreset[] = [
  nodia,
  tweakcnDefault,
  modernMinimal,
  violetBloom,
  t3Chat,
  twitter,
  mochaMousse,
  bubblegum,
  amethystHaze,
  notebook,
  doom64,
  catppuccin,
  graphite,
  perpetuity,
  kodamaGrove,
  cosmicNight,
  tangerine,
  quantumRose,
  nature,
  boldTech,
  elegantLuxury,
  amberMinimal,
  supabase,
  neoBrutalism,
  solarDusk,
  claymorphism,
  cyberpunk,
  pastelDreams,
  cleanSlate,
  caffeine,
  oceanBreeze,
  retroArcade,
  midnightBloom,
  candyland,
  northernLights,
  vintagePaper,
  sunsetHorizon,
  starryNight,
  claude,
  vercel,
  darkmatter,
  mono,
  softPop,
  sageGarden,
];

const presetsById = new Map(themePresets.map((preset) => [preset.id, preset]));

export const isThemePresetId = (value: unknown): value is string =>
  typeof value === "string" && presetsById.has(value);

export const resolveThemePreset = (value: unknown): AppThemePreset =>
  (typeof value === "string" ? presetsById.get(value) : undefined) ?? nodia;
