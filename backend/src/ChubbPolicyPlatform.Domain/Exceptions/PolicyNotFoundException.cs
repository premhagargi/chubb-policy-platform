namespace ChubbPolicyPlatform.Domain.Exceptions;

public class PolicyNotFoundException(Guid id) : Exception($"Policy '{id}' was not found.");
