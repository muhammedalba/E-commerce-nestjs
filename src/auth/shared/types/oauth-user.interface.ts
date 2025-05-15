export interface OAuthUser {
  email: string;
  name: string;
  picture: string;
  provider: string;
  facebookId?: string; // or facebookId
  providerId?: string; // or facebookId
}
