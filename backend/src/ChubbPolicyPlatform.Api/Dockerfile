FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ChubbPolicyPlatform.sln ./
COPY src/ChubbPolicyPlatform.Domain/*.csproj src/ChubbPolicyPlatform.Domain/
COPY src/ChubbPolicyPlatform.Application/*.csproj src/ChubbPolicyPlatform.Application/
COPY src/ChubbPolicyPlatform.Infrastructure/*.csproj src/ChubbPolicyPlatform.Infrastructure/
COPY src/ChubbPolicyPlatform.Api/*.csproj src/ChubbPolicyPlatform.Api/
RUN dotnet restore src/ChubbPolicyPlatform.Api/ChubbPolicyPlatform.Api.csproj

COPY . .
RUN dotnet publish src/ChubbPolicyPlatform.Api/ChubbPolicyPlatform.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# curl is used by the docker-compose healthcheck; not present in the base runtime image.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "ChubbPolicyPlatform.Api.dll"]
