export function createPageUrl(pageName: string) {
    if (pageName === "Home") return "/";
    return '/' + pageName.replace(/ /g, '-');
}