export const loadCategoryDefaults = () => {
    const defaultCategories = [
        "House Party",
        "Breakup",
        "College Golden Age",
        "We Grown Folks",
        "Childhood Classics",
        "High School Hits",
        "80's Prom",
        "Sing to me, it's Disney!",
        "Girls Night Out",
        "Boys Night Out",
        "Speak with Country Grammar",
        "RIP",
        "Relax, we're on Island Time"
    ];

    let randomCategories = [];

    for (let x = 0; x < 3; x ++) {
        const position = Math.floor(Math.random() * (defaultCategories.length-1));
        randomCategories.push(defaultCategories[position]);
    }
    
    return randomCategories;
};

export const randomNumGen = (length=1) => {
    return Math.floor(Math.random() * (length-1));
};

export const generateRandomCode = (length=4) => {
    const alpha_characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    const lower_characters = alpha_characters.toLowerCase();
    const num_characters = '1234567890';

    const totalCharacters = alpha_characters.split('').concat(lower_characters.split('')).concat(num_characters.split(''));

    let code = "";

    for (let x = 0; x < length; x ++) {
        const position = Math.floor(Math.random() * (totalCharacters.length-1));
        code += totalCharacters[position];
    }

    return code;
};