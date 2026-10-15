let pushToken: string | null = null;

export const getPushToken = () => pushToken;
export const setPushToken = (token: string) => {
  pushToken = token;
};
