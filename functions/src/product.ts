export interface Product
{
    boughtCount: number;
    postCount: number;
    recommendationCount: number;
    totalPostLikes: number;
    totalRecommendationLikes: number;

    brand: string;
    category: string;
    dateAdded: Date;
    details: string;
    domain: string;
    externalId: string;
    favoriteCount: number;
    hero: string;
    isActive: boolean;
    isCatchofTheDay: boolean;
    isHighlighted: boolean;
    isPopularUS: boolean;
    link: string;
    localPath: string;
    remotePath: string;
    saveCount: number;
    shipping: string;
    subtitle: string;
    title: string;
}
