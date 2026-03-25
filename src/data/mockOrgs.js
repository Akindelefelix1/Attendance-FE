export const mockOrganizations = [
  {
    id: "org-1",
    name: "BrightPath Logistics",
    location: "Lagos",
    settings: {
      lateAfterTime: "09:15",
      earlyCheckoutBeforeTime: "17:00",
      roles: ["Fleet Manager", "Dispatch Lead", "Driver"]
    },
    staff: [
      {
        id: "staff-1",
        fullName: "Chinedu Okafor",
        role: "Fleet Manager",
        email: "chinedu@brightpath.com"
      },
      {
        id: "staff-2",
        fullName: "Zainab Musa",
        role: "Dispatch Lead",
        email: "zainab@brightpath.com"
      }
    ]
  },
  {
    id: "org-2",
    name: "Northwind Foods",
    location: "Abuja",
    settings: {
      lateAfterTime: "09:30",
      earlyCheckoutBeforeTime: "17:30",
      roles: ["Operations Lead", "Quality Analyst", "Warehouse"]
    },
    staff: [
      {
        id: "staff-3",
        fullName: "David Osei",
        role: "Operations Lead",
        email: "david@northwind.com"
      },
      {
        id: "staff-4",
        fullName: "Aisha Bello",
        role: "Quality Analyst",
        email: "aisha@northwind.com"
      }
    ]
  }
];
