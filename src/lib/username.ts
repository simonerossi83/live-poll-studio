const ADJECTIVES = [
  "Swift", "Brave", "Clever", "Mighty", "Cosmic", "Lucky", "Ninja",
  "Turbo", "Hyper", "Epic", "Legendary", "Blazing", "Stealth", "Neon",
  "Wild", "Frozen", "Golden", "Shadow", "Electric", "Mystic",
];

const ANIMALS = [
  "Tiger", "Eagle", "Panda", "Wolf", "Shark", "Phoenix", "Dragon",
  "Falcon", "Cobra", "Jaguar", "Lynx", "Otter", "Raven", "Viper",
  "Koala", "Gecko", "Penguin", "Rhino", "Bison", "Octopus",
];

export function generateUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 90) + 10; // 10-99
  return `${adj}${animal}${num}`;
}
