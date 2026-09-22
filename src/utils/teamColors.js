// Team color mappings — updated for 2026 F1 season
export const TEAM_COLORS = {
  'Red Bull Racing': '#3671C6',
  'Mercedes': '#27F4D2',
  'Ferrari': '#E8002D',
  'McLaren': '#FF8000',
  'Aston Martin': '#229971',
  'Alpine': '#FF87BC',
  'Williams': '#64C4FF',
  'RB': '#6692FF',
  'Kick Sauber': '#52E252',
  'Haas F1 Team': '#B6BABD',
  // 2026 new / rebranded teams
  'Audi': '#D0D0D0',
  'Cadillac': '#CC1E4A',
  'Racing Bulls': '#6692FF',
  // Aliases
  'Red Bull': '#3671C6',
  'Aston Martin F1 Team': '#229971',
  'Alpine F1 Team': '#FF87BC',
  'Williams Racing': '#64C4FF',
  'Haas': '#B6BABD',
  'Sauber': '#52E252',
  'AlphaTauri': '#6692FF',
  'Visa Cash App RB': '#6692FF',
};

export const getTeamColor = (teamName) => {
  if (!teamName) return '#6B7280'; // default gray
  
  // Try exact match first
  if (TEAM_COLORS[teamName]) {
    return TEAM_COLORS[teamName];
  }
  
  // Try partial match
  const normalizedName = teamName.toLowerCase();
  for (const [team, color] of Object.entries(TEAM_COLORS)) {
    if (normalizedName.includes(team.toLowerCase()) || team.toLowerCase().includes(normalizedName)) {
      return color;
    }
  }
  
  return '#6B7280'; // default gray
};

export const getDriverColor = (teamName) => {
  return getTeamColor(teamName);
};

export const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};
