using ChubbPolicyPlatform.Api.Endpoints;
using ChubbPolicyPlatform.Api.Middleware;
using ChubbPolicyPlatform.Application;
using ChubbPolicyPlatform.Infrastructure;
using ChubbPolicyPlatform.Infrastructure.Persistence;
using ChubbPolicyPlatform.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// --- Structured logging (Serilog) ---
builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithMachineName()
    .WriteTo.Console());

// --- Cross-cutting / DI ---
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddPolicy("AllowAngularDev", policy => policy
    .WithOrigins(corsOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new() { Title = "Chubb APAC Policy Management Platform API", Version = "v1" });
});

var app = builder.Build();

// --- Migrate + seed on startup (self-contained standalone demo; a dedicated
// migration job/init-container is the more production-correct pattern at real scale —
// documented as a known trade-off in docs/ARCHITECTURE.md). ---
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    // InMemory provider (POC mode, no connection string configured) doesn't support
    // migrations at all — EnsureCreated is the InMemory-appropriate equivalent.
    if (db.Database.IsInMemory())
        await db.Database.EnsureCreatedAsync();
    else
        await db.Database.MigrateAsync();

    await PolicySeeder.SeedAsync(db, logger);
}

app.UseSerilogRequestLogging();
app.UseExceptionHandler();
app.UseCors("AllowAngularDev");

app.UseSwagger();
app.UseSwaggerUI();

app.MapPolicyEndpoints();
app.MapHealthChecks("/health");

app.Run();

// Exposed for WebApplicationFactory<Program> in integration tests.
public partial class Program;
