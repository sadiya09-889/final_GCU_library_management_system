import type { AcademicProgramme } from "./types";

export const ACADEMIC_PROGRAMMES: AcademicProgramme[] = [
    {
        school: "School of Health Science",
        department: "Bachelor of Physiotherapy",
        sheet_name: "BPhysio",
        unique_titles: 427,
        total_copies: 866,
    },
    {
        school: "School of Social Sciences",
        department: "Bachelor of Science Psychology",
        sheet_name: "BSc-Psych",
        unique_titles: 890,
        total_copies: 1239,
    },
    {
        school: "School of Sciences",
        department: "B.Sc. Biotechnology, Biochemistry, Genetics",
        sheet_name: "BSc-BBG",
        unique_titles: 780,
        total_copies: 2218,
    },
    {
        school: "School of Sciences",
        department: "B.Sc. Bioinformatics, Statistics, Data Science",
        sheet_name: "BSc-BioInfo",
        unique_titles: 331,
        total_copies: 713,
    },
    {
        school: "School of Sciences",
        department: "B.Sc. Forensic Sciences, Chemistry & Genetics",
        sheet_name: "BSc-Forensic",
        unique_titles: 204,
        total_copies: 377,
    },
    {
        school: "School of Sciences",
        department: "B.Sc. Food Science & Technology, Biochemistry, Microbiology",
        sheet_name: "BSc-Food",
        unique_titles: 1232,
        total_copies: 2526,
    },
    {
        school: "School of Media Studies",
        department: "B.Sc. Visual Communication",
        sheet_name: "BSc-VisComm",
        unique_titles: 293,
        total_copies: 390,
    },
    {
        school: "School of Media Studies",
        department: "BA Journalism, Psychology",
        sheet_name: "BA-Journalism",
        unique_titles: 182,
        total_copies: 252,
    },
    {
        school: "School of Media Studies",
        department: "Bachelor of Design",
        sheet_name: "BDesign",
        unique_titles: 6,
        total_copies: 6,
    },
    {
        school: "School of Indian and Foreign Languages",
        department: "B.A English with Computational Linguistics",
        sheet_name: "BA-EngLing",
        unique_titles: 1439,
        total_copies: 1950,
    },
    {
        school: "School of Indian and Foreign Languages",
        department: "B.A English and Psychology",
        sheet_name: "BA-EngPsych",
        unique_titles: 204,
        total_copies: 405,
    },
    {
        school: "School of Indian and Foreign Languages",
        department: "Indian Languages",
        sheet_name: "IndianLang",
        unique_titles: 754,
        total_copies: 950,
    },
    {
        school: "Dr. APJ Abdul Kalam School of Engineering",
        department: "B.Tech / BE Computer Science",
        sheet_name: "BTech-CS",
        unique_titles: 23,
        total_copies: 29,
    },
    {
        school: "Dr. APJ Abdul Kalam School of Engineering",
        department: "B.Tech in Robotic Engineering",
        sheet_name: "BTech-Robotic",
        unique_titles: 2,
        total_copies: 3,
    },
    {
        school: "Dr. APJ Abdul Kalam School of Engineering",
        department: "B.Tech Electronics Engineering",
        sheet_name: "BTech-ECE",
        unique_titles: 239,
        total_copies: 483,
    },
    {
        school: "School of Computational Science & IT",
        department: "Bachelor of Computer Applications",
        sheet_name: "BCA",
        unique_titles: 2369,
        total_copies: 6471,
    },
    {
        school: "School of Computational Science & IT",
        department: "B.Sc Data Science & Cyber Security",
        sheet_name: "BSc-DS",
        unique_titles: 556,
        total_copies: 1354,
    },
    {
        school: "School of Professional Studies",
        department: "Bachelor of Hotel Management",
        sheet_name: "BHotelMgmt",
        unique_titles: 1644,
        total_copies: 2986,
    },
    {
        school: "School of Professional Studies",
        department: "BSc Fashion & Apparel Design",
        sheet_name: "BSc-FAD",
        unique_titles: 570,
        total_copies: 795,
    },
    {
        school: "School of Commerce & Management",
        department: "B.Com - Bachelor of Commerce",
        sheet_name: "BCom",
        unique_titles: 1962,
        total_copies: 4628,
    },
    {
        school: "School of Commerce & Management",
        department: "BBA - Business Administration",
        sheet_name: "BBA",
        unique_titles: 3193,
        total_copies: 6900,
    },
    {
        school: "General Reference",
        department: "General Reference",
        sheet_name: "General",
        unique_titles: 245,
        total_copies: 278,
        is_general_reference: true,
    },
];

export function getSchoolDisplayName(school: string) {
    return school === "General Reference" ? "Library / General Reference" : school;
}

export function groupProgrammesBySchool(programmes: AcademicProgramme[]) {
    return programmes.reduce((groups, programme) => {
        const existing = groups.get(programme.school) ?? [];
        existing.push(programme);
        groups.set(programme.school, existing);
        return groups;
    }, new Map<string, AcademicProgramme[]>());
}

const PROGRAMME_RECOMMENDATION_KEYWORDS: Record<string, string[]> = {
    "bachelor of physiotherapy": ["Physiotherapy", "Physiology", "Anatomy"],
    "bachelor of science psychology": ["Psychology", "Social Work", "General Knowledge"],
    "b.sc. biotechnology, biochemistry, genetics": ["Biotechnology", "Biochemistry", "Genetics"],
    "b.sc. bioinformatics, statistics, data science": ["Bioinformatics", "Statistics", "Data Science"],
    "b.sc. forensic sciences, chemistry & genetics": ["Forensic", "Chemistry", "Genetics"],
    "b.sc. food science & technology, biochemistry, microbiology": ["Food Science", "Food Technology", "Biochemistry", "Microbiology"],
    "b.sc. visual communication": ["Visual Communication", "Mass Communication", "Electronic Media"],
    "ba journalism, psychology": ["Journalism", "Media Studies", "Psychology"],
    "bachelor of design": ["Design", "Arts"],
    "b.a english with computational linguistics": ["English", "Linguistics", "Computational Linguistics"],
    "b.a english and psychology": ["English", "Psychology", "Literature"],
    "indian languages": ["Hindi", "Kannada", "Indian Languages"],
    "b.tech / be computer science": ["Engineering", "Computer Science"],
    "b.tech in robotic engineering": ["Robotics", "Mechanical Engineering", "Engineering"],
    "b.tech electronics engineering": ["Electronics", "Physics", "Engineering"],
    "bachelor of computer applications": ["Computer Science", "Computer Applications", "Programming", "Database"],
    "b.sc data science & cyber security": ["Data Science", "Cyber Security", "Mathematics", "Computer Science"],
    "bachelor of hotel management": ["Hotel Management", "Tourism", "Food"],
    "bsc fashion & apparel design": ["Fashion", "Apparel", "FAD"],
    "b.com - bachelor of commerce": ["Commerce", "Economics", "Accounting", "Law"],
    "bba - business administration": ["Management", "Business Administration", "Marketing"],
    "general reference": ["General", "Reference", "Encyclopedia"],
};

export function getProgrammeRecommendationKeywords(school: string, department: string) {
    const mapped = PROGRAMME_RECOMMENDATION_KEYWORDS[department.toLowerCase()];
    if (mapped?.length) return mapped;

    const stopWords = new Set([
        "bachelor",
        "science",
        "school",
        "with",
        "and",
        "the",
        "department",
        "degree",
    ]);

    return Array.from(new Set(
        `${department} ${school}`
            .replace(/[&/.,()-]/g, " ")
            .split(/\s+/)
            .map((word) => word.trim())
            .filter((word) => word.length > 3 && !stopWords.has(word.toLowerCase())),
    ));
}
