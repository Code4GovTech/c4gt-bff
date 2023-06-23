FROM node:16
WORKDIR /app
COPY . ./
RUN yarn
EXPOSE 3001
CMD ["yarn", "start"]