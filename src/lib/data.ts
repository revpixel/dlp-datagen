// Seed lists. Names are common census names; email domains are reserved
// example domains (RFC 2606) so no generated address can reach a real inbox.

export const FIRST_NAMES = [
	"James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
	"David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
	"Thomas", "Sarah", "Charles", "Karen", "Christopher", "Lisa", "Daniel", "Nancy",
	"Matthew", "Betty", "Anthony", "Sandra", "Mark", "Margaret", "Donald", "Ashley",
	"Steven", "Kimberly", "Andrew", "Emily", "Paul", "Donna", "Joshua", "Michelle",
	"Kenneth", "Carol", "Kevin", "Amanda", "Brian", "Melissa", "Timothy", "Deborah",
	"Ronald", "Stephanie", "Jason", "Rebecca", "George", "Sharon", "Edward", "Laura",
	"Jordan", "Taylor", "Alex", "Morgan", "Casey", "Riley", "Jamie", "Avery",
	"Priya", "Wei", "Mohammed", "Sofia", "Diego", "Aisha", "Hiroshi", "Olga",
];

export const LAST_NAMES = [
	"Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
	"Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas",
	"Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White",
	"Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young",
	"Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
	"Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
	"Carter", "Roberts", "Patel", "Kim", "Chen", "Singh", "Okafor", "Kowalski",
];

export const EMAIL_DOMAINS = ["example.com", "example.org", "example.net"];

export const STREET_NAMES = [
	"Main", "Oak", "Pine", "Maple", "Cedar", "Elm", "Washington", "Lake", "Hill",
	"Park", "Sunset", "Lincoln", "Jackson", "Church", "River", "Highland", "Willow",
	"Meadow", "Forest", "Spring", "Ridge", "Valley", "Franklin", "Jefferson",
];

export const STREET_SUFFIXES = ["St", "Ave", "Rd", "Blvd", "Ln", "Dr", "Ct", "Way", "Pl"];

export interface Place {
	city: string;
	state: string;
	zip3: string;
	areaCodes: readonly string[];
}

export const PLACES: readonly Place[] = [
	{ city: "New York", state: "NY", zip3: "100", areaCodes: ["212", "646", "917"] },
	{ city: "Buffalo", state: "NY", zip3: "142", areaCodes: ["716"] },
	{ city: "Los Angeles", state: "CA", zip3: "900", areaCodes: ["213", "310", "323"] },
	{ city: "San Diego", state: "CA", zip3: "921", areaCodes: ["619", "858"] },
	{ city: "San Jose", state: "CA", zip3: "951", areaCodes: ["408", "669"] },
	{ city: "Chicago", state: "IL", zip3: "606", areaCodes: ["312", "773"] },
	{ city: "Houston", state: "TX", zip3: "770", areaCodes: ["713", "281", "832"] },
	{ city: "Austin", state: "TX", zip3: "787", areaCodes: ["512", "737"] },
	{ city: "Dallas", state: "TX", zip3: "752", areaCodes: ["214", "469", "972"] },
	{ city: "Phoenix", state: "AZ", zip3: "850", areaCodes: ["602", "480"] },
	{ city: "Philadelphia", state: "PA", zip3: "191", areaCodes: ["215", "267"] },
	{ city: "Pittsburgh", state: "PA", zip3: "152", areaCodes: ["412"] },
	{ city: "Jacksonville", state: "FL", zip3: "322", areaCodes: ["904"] },
	{ city: "Miami", state: "FL", zip3: "331", areaCodes: ["305", "786"] },
	{ city: "Tampa", state: "FL", zip3: "336", areaCodes: ["813"] },
	{ city: "Columbus", state: "OH", zip3: "432", areaCodes: ["614"] },
	{ city: "Charlotte", state: "NC", zip3: "282", areaCodes: ["704", "980"] },
	{ city: "Seattle", state: "WA", zip3: "981", areaCodes: ["206"] },
	{ city: "Denver", state: "CO", zip3: "802", areaCodes: ["303", "720"] },
	{ city: "Boston", state: "MA", zip3: "021", areaCodes: ["617", "857"] },
	{ city: "Nashville", state: "TN", zip3: "372", areaCodes: ["615"] },
	{ city: "Portland", state: "OR", zip3: "972", areaCodes: ["503", "971"] },
	{ city: "Atlanta", state: "GA", zip3: "303", areaCodes: ["404", "470"] },
	{ city: "Minneapolis", state: "MN", zip3: "554", areaCodes: ["612"] },
	{ city: "Detroit", state: "MI", zip3: "482", areaCodes: ["313"] },
	{ city: "Baltimore", state: "MD", zip3: "212", areaCodes: ["410", "443"] },
	{ city: "Milwaukee", state: "WI", zip3: "532", areaCodes: ["414"] },
	{ city: "Salt Lake City", state: "UT", zip3: "841", areaCodes: ["801"] },
	{ city: "Las Vegas", state: "NV", zip3: "891", areaCodes: ["702", "725"] },
	{ city: "Richmond", state: "VA", zip3: "232", areaCodes: ["804"] },
];

export const ICD10: readonly (readonly [string, string])[] = [
	["E11.9", "Type 2 diabetes mellitus without complications"],
	["I10", "Essential (primary) hypertension"],
	["E78.5", "Hyperlipidemia, unspecified"],
	["J45.909", "Unspecified asthma, uncomplicated"],
	["F32.9", "Major depressive disorder, single episode, unspecified"],
	["F41.1", "Generalized anxiety disorder"],
	["M54.50", "Low back pain, unspecified"],
	["K21.9", "Gastro-esophageal reflux disease without esophagitis"],
	["N39.0", "Urinary tract infection, site not specified"],
	["J06.9", "Acute upper respiratory infection, unspecified"],
	["G43.909", "Migraine, unspecified, not intractable"],
	["E66.9", "Obesity, unspecified"],
	["I25.10", "Atherosclerotic heart disease of native coronary artery"],
	["E03.9", "Hypothyroidism, unspecified"],
	["J44.9", "Chronic obstructive pulmonary disease, unspecified"],
	["C50.919", "Malignant neoplasm of unspecified site of unspecified female breast"],
	["B20", "Human immunodeficiency virus [HIV] disease"],
	["F10.20", "Alcohol dependence, uncomplicated"],
	["O80", "Encounter for full-term uncomplicated delivery"],
	["Z23", "Encounter for immunization"],
];

export const MEDICATIONS = [
	"Metformin 500 mg", "Lisinopril 10 mg", "Atorvastatin 20 mg", "Levothyroxine 50 mcg",
	"Albuterol HFA 90 mcg", "Sertraline 50 mg", "Omeprazole 20 mg", "Amlodipine 5 mg",
	"Gabapentin 300 mg", "Hydrochlorothiazide 25 mg", "Escitalopram 10 mg", "Insulin glargine 100 U/mL",
];

export const INSURERS = [
	"Aetna", "Blue Cross Blue Shield", "Cigna", "UnitedHealthcare", "Humana", "Kaiser Permanente", "Medicare", "Medicaid",
];
